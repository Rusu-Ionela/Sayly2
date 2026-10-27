import { readFile, unlink, writeFile } from "fs/promises";
import path from "path";

import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq, inArray, lt, ne, or, sql } from "drizzle-orm";

import { db, type DbTransaction } from "../../db/client";
import {
  conversationParticipants,
  mediaAssets,
  messages,
  profiles,
  stories,
  users,
  voiceSparks,
} from "../../db/schema";
import { env } from "../../config/env";
import { AppError } from "../../shared/errors/AppError";

import {
  extensionForMime,
  extractStorageKey,
  inspectUploadedFile,
  mediaKindFromMime,
  signedFileUrl,
  stableFilePath,
  UPLOADS_DIR,
} from "./storage";
import type { UploadResult } from "./types";
import { lockUser } from "../../db/helpers";

type DbClient = typeof db | DbTransaction;

async function assertWithinQuota(ownerId: string, incomingBytes: number, client: DbClient = db) {
  const [usage] = await client
    .select({ total: sql<string>`coalesce(sum(${mediaAssets.size}), 0)` })
    .from(mediaAssets)
    .where(eq(mediaAssets.ownerId, ownerId));

  const usedBytes = Number(usage?.total ?? 0);
  if (usedBytes + incomingBytes > env.mediaUserQuotaBytes) {
    throw new AppError(
      "Storage quota exceeded. Remove old media or use a smaller file.",
      413,
      "VALIDATION_ERROR",
    );
  }
}

/** Uploads younger than this may still be about to be attached to a message or profile. */
const UNUSED_MEDIA_GRACE_MS = 60 * 60 * 1000;
const RECLAIM_BATCH = 500;

/**
 * Deletes the owner's uploads that no message, avatar or gallery points to any more, and returns
 * their storage keys so the caller can remove the files once the transaction has committed.
 * One pass over each referencing table per sweep, never one scan per asset.
 */
async function reclaimUnusedMedia(
  tx: DbTransaction,
  ownerId: string,
  graceMs = UNUSED_MEDIA_GRACE_MS,
): Promise<string[]> {
  const candidates = await tx
    .select({ id: mediaAssets.id, storageKey: mediaAssets.storageKey })
    .from(mediaAssets)
    .where(
      and(eq(mediaAssets.ownerId, ownerId), lt(mediaAssets.createdAt, new Date(Date.now() - graceMs))),
    )
    .orderBy(asc(mediaAssets.createdAt))
    .limit(RECLAIM_BATCH);
  if (candidates.length === 0) {
    return [];
  }

  // Storage keys are alphanumeric (safeStorageKey), so they are safe inside a regex.
  const keys = candidates.map((asset) => asset.storageKey);
  const pattern = `^/media/files/(${keys.join("|")})(\\?|$)`;
  const stablePaths = keys.map(stableFilePath);

  const [messageRefs, profileRefs, userRefs, sparkRefs, storyRefs] = await Promise.all([
    tx
      .select({ content: messages.content, thumbnailUrl: messages.thumbnailUrl })
      .from(messages)
      .where(or(sql`${messages.content} ~ ${pattern}`, sql`${messages.thumbnailUrl} ~ ${pattern}`)),
    tx
      .select({ image: profiles.profileImageUrl, photos: profiles.photos })
      .from(profiles)
      .where(
        or(
          sql`${profiles.profileImageUrl} ~ ${pattern}`,
          sql`${profiles.photos} && ${sql`array[${sql.join(stablePaths.map((p) => sql`${p}`), sql`, `)}]::text[]`}`,
        ),
      ),
    tx.select({ photo: users.photoUrl }).from(users).where(sql`${users.photoUrl} ~ ${pattern}`),
    tx.select({ audio: voiceSparks.audioUrl }).from(voiceSparks).where(inArray(voiceSparks.audioUrl, stablePaths)),
    tx.select({ media: stories.mediaUrl }).from(stories).where(inArray(stories.mediaUrl, stablePaths)),
  ]);

  const used = new Set<string>();
  for (const url of [
    ...messageRefs.flatMap((row) => [row.content, row.thumbnailUrl]),
    ...profileRefs.flatMap((row) => [row.image, ...row.photos]),
    ...userRefs.map((row) => row.photo),
    ...sparkRefs.map((row) => row.audio),
    ...storyRefs.map((row) => row.media),
  ]) {
    const key = extractStorageKey(url);
    if (key) used.add(key);
  }

  const unused = candidates.filter((asset) => !used.has(asset.storageKey));
  if (unused.length === 0) {
    return [];
  }
  await tx.delete(mediaAssets).where(inArray(mediaAssets.id, unused.map((asset) => asset.id)));
  return unused.map((asset) => asset.storageKey);
}

/** Frees the owner's uploads nothing points to any more (e.g. the media of expired Voice Sparks and stories). */
export async function reclaimOwnerMedia(ownerId: string) {
  const keys = await db.transaction(async (tx) => {
    await lockUser(tx, ownerId);
    return reclaimUnusedMedia(tx, ownerId);
  });
  await Promise.all(keys.map((key) => unlink(path.join(UPLOADS_DIR, key)).catch(() => undefined)));
}

/** An upload the member owns, by any URL form of it (stable or signed), or null. */
export async function findOwnedAsset(ownerId: string, fileUrl: string) {
  const key = extractStorageKey(fileUrl);
  if (!key) return null;
  const [asset] = await db
    .select({ storageKey: mediaAssets.storageKey, mimeType: mediaAssets.mimeType, size: mediaAssets.size })
    .from(mediaAssets)
    .where(and(eq(mediaAssets.ownerId, ownerId), eq(mediaAssets.storageKey, key)))
    .limit(1);
  return asset ?? null;
}

/** For account deletion: removes every upload no message still shows (avatar, gallery, strays). */
export async function purgeUnusedMedia(ownerId: string) {
  const keys = await db.transaction((tx) => reclaimUnusedMedia(tx, ownerId, 0));
  await Promise.all(keys.map((key) => unlink(path.join(UPLOADS_DIR, key)).catch(() => undefined)));
}

export async function createOwnedUpload(
  ownerId: string,
  file: Express.Multer.File | undefined,
): Promise<UploadResult> {
  if (!file) {
    throw new AppError("A file is required", 400, "VALIDATION_ERROR");
  }

  try {
    await inspectUploadedFile(file.path, file.mimetype);

    // Locking the owner row makes parallel uploads queue up, so the quota check cannot be raced.
    const { asset, reclaimed } = await db.transaction(async (tx) => {
      await lockUser(tx, ownerId);

      const usedBytes = async () => {
        const [usage] = await tx
          .select({ total: sql<string>`coalesce(sum(${mediaAssets.size}), 0)` })
          .from(mediaAssets)
          .where(eq(mediaAssets.ownerId, ownerId));
        return Number(usage?.total ?? 0);
      };

      let reclaimedKeys: string[] = [];
      if ((await usedBytes()) + file.size > env.mediaUserQuotaBytes) {
        // Over budget: free files nothing uses any more before refusing the upload.
        reclaimedKeys = await reclaimUnusedMedia(tx, ownerId);
        if ((await usedBytes()) + file.size > env.mediaUserQuotaBytes) {
          throw new AppError(
            "Storage quota exceeded. Remove old media or use a smaller file.",
            413,
            "VALIDATION_ERROR",
          );
        }
      }

      const [inserted] = await tx
        .insert(mediaAssets)
        .values({
          ownerId,
          storageKey: file.filename,
          mimeType: file.mimetype,
          size: file.size,
          kind: mediaKindFromMime(file.mimetype),
          purpose: "CHAT",
        })
        .returning();
      return { asset: inserted, reclaimed: reclaimedKeys };
    });

    await Promise.all(
      reclaimed.map((key) => unlink(path.join(UPLOADS_DIR, key)).catch(() => undefined)),
    );

    if (!asset) {
      throw new AppError("Failed to store upload", 500, "INTERNAL_ERROR");
    }

    return {
      url: stableFilePath(asset.storageKey),
      signedUrl: signedFileUrl(asset.storageKey),
      mimeType: asset.mimeType,
      kind: mediaKindFromMime(asset.mimeType),
      size: asset.size,
      assetId: asset.id,
    };
  } catch (error) {
    // Multer already wrote the file; a rejected upload must not stay on disk.
    await unlink(file.path).catch(() => undefined);
    throw error;
  }
}

/**
 * Media references from clients must point at a file the sender uploaded.
 * Returns the stable stored path; rejects external URLs and other users' keys.
 */
export async function requireOwnedMediaPath(ownerId: string, fileUrl: string): Promise<string> {
  const key = extractStorageKey(fileUrl);
  if (key) {
    const [owned] = await db
      .select({ id: mediaAssets.id })
      .from(mediaAssets)
      .where(and(eq(mediaAssets.ownerId, ownerId), eq(mediaAssets.storageKey, key)))
      .limit(1);
    if (owned) {
      return stableFilePath(key);
    }
  }
  throw new AppError("Media must be a file you uploaded", 400, "VALIDATION_ERROR");
}

export async function mimeTypeForStorageKey(storageKey: string): Promise<string | null> {
  const [asset] = await db
    .select({ mimeType: mediaAssets.mimeType })
    .from(mediaAssets)
    .where(eq(mediaAssets.storageKey, storageKey))
    .limit(1);
  return asset?.mimeType ?? null;
}

export async function userCanAccessStorageKey(userId: string, storageKey: string): Promise<boolean> {
  const [owned] = await db
    .select({ id: mediaAssets.id })
    .from(mediaAssets)
    .where(and(eq(mediaAssets.ownerId, userId), eq(mediaAssets.storageKey, storageKey)))
    .limit(1);

  if (owned) {
    return true;
  }

  // Stored paths carry no ?exp=&sig= (migration 0011 cleaned older rows), so plain equality
  // can use the indexes on these columns.
  const stable = stableFilePath(storageKey);

  const [inMessage] = await db
    .select({ id: messages.id })
    .from(messages)
    .innerJoin(
      conversationParticipants,
      and(
        eq(conversationParticipants.conversationId, messages.conversationId),
        eq(conversationParticipants.userId, userId),
      ),
    )
    .where(
      or(
        and(ne(messages.type, "TEXT"), eq(messages.content, stable)),
        eq(messages.thumbnailUrl, stable),
      ),
    )
    .limit(1);

  if (inMessage) {
    return true;
  }

  // Profile avatars are visible to any authenticated user (discovery / public profile).
  const [avatar] = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(eq(profiles.profileImageUrl, stable))
    .limit(1);

  return Boolean(avatar);
}

/**
 * Writes an already-validated inline image (e.g. a base64 avatar) to storage.
 * The `MediaAsset` row is inserted on the caller's transaction so it commits together
 * with whatever references it; call `discard()` if that transaction rolls back.
 */
export async function storeInlineImage(
  ownerId: string,
  image: { mimeType: string; data: Buffer },
  purpose: string,
  tx: DbTransaction,
): Promise<{ path: string; discard: () => Promise<void> }> {
  const extension = extensionForMime(image.mimeType);
  if (!extension || mediaKindFromMime(image.mimeType) !== "image") {
    throw new AppError("This file type is not allowed", 400, "VALIDATION_ERROR");
  }

  await assertWithinQuota(ownerId, image.data.byteLength, tx);

  const storageKey = `${createId()}${extension}`;
  const filePath = path.join(UPLOADS_DIR, storageKey);
  await writeFile(filePath, image.data, { flag: "wx" });

  await tx.insert(mediaAssets).values({
    ownerId,
    storageKey,
    mimeType: image.mimeType,
    size: image.data.byteLength,
    kind: "image",
    purpose,
  });

  return {
    path: stableFilePath(storageKey),
    discard: () => unlink(filePath).catch(() => undefined),
  };
}

/**
 * Guards a `/media/files/...` reference before it becomes public (e.g. an avatar): it must
 * be an image the user uploaded and at most `maxBytes`. Without this, anyone could point
 * their avatar at another user's chat attachment and make it readable to everyone.
 * Returns the verified storage key.
 */
export async function assertOwnedImageAsset(
  ownerId: string,
  mediaPath: string,
  maxBytes: number,
  client: DbClient = db,
): Promise<string> {
  const storageKey = extractStorageKey(mediaPath);
  if (!storageKey) {
    throw new AppError("Invalid media path", 400, "VALIDATION_ERROR");
  }

  const [asset] = await client
    .select({ kind: mediaAssets.kind, size: mediaAssets.size })
    .from(mediaAssets)
    .where(and(eq(mediaAssets.ownerId, ownerId), eq(mediaAssets.storageKey, storageKey)))
    .limit(1);

  if (!asset || asset.kind !== "image") {
    throw new AppError("Profile image must be an image you uploaded", 400, "VALIDATION_ERROR");
  }
  if (asset.size > maxBytes) {
    throw new AppError(
      `Profile image must be ${Math.round(maxBytes / (1024 * 1024))} MB or smaller`,
      400,
      "VALIDATION_ERROR",
    );
  }
  return storageKey;
}

/** Bytes of a stored upload (already validated by key). */
export function readStoredFile(storageKey: string): Promise<Buffer> {
  return readFile(path.join(UPLOADS_DIR, storageKey));
}
