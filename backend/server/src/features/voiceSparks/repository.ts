import { and, count, desc, eq, gt, inArray, isNull, lt, ne, or, type SQL } from "drizzle-orm";

import { db } from "../../db/client";
import { languages, profiles, userLanguages, users, voiceSparks } from "../../db/schema";
import { notBlockedBetween } from "../safety/blockFilter";

/** Live sparks older than the newest ones are read in one window and deduped per author. */
const FEED_WINDOW = 200;

export const sparkColumns = {
  id: voiceSparks.id,
  userId: voiceSparks.userId,
  languageId: voiceSparks.languageId,
  audioUrl: voiceSparks.audioUrl,
  durationMs: voiceSparks.durationMs,
  replyToId: voiceSparks.replyToId,
  replyToUserId: voiceSparks.replyToUserId,
  createdAt: voiceSparks.createdAt,
  expiresAt: voiceSparks.expiresAt,
  displayName: profiles.displayName,
  profileImageUrl: profiles.profileImageUrl,
  languageName: languages.name,
  flagEmoji: languages.flagEmoji,
};

export type SparkRow = {
  id: string;
  userId: string;
  languageId: string;
  audioUrl: string;
  durationMs: number;
  replyToId: string | null;
  replyToUserId: string | null;
  createdAt: Date;
  expiresAt: Date;
  displayName: string;
  profileImageUrl: string | null;
  languageName: string;
  flagEmoji: string;
};

function selectSparks() {
  return db
    .select(sparkColumns)
    .from(voiceSparks)
    .innerJoin(users, eq(users.id, voiceSparks.userId))
    .innerJoin(profiles, eq(profiles.userId, voiceSparks.userId))
    .innerJoin(languages, eq(languages.id, voiceSparks.languageId));
}

const live = (now: Date) => gt(voiceSparks.expiresAt, now);
const activeAuthor = () => and(eq(users.status, "ACTIVE"), eq(users.onboardingCompleted, true));

export async function insertSpark(values: {
  userId: string;
  languageId: string;
  audioUrl: string;
  durationMs: number;
  replyToId: string | null;
  replyToUserId: string | null;
  createdAt: Date;
  expiresAt: Date;
}) {
  const [row] = await db.insert(voiceSparks).values(values).returning({ id: voiceSparks.id });
  if (!row) throw new Error("Voice spark was not saved");
  return row.id;
}

export async function findLiveSpark(id: string, now: Date): Promise<SparkRow | null> {
  const [row] = await selectSparks()
    .where(and(eq(voiceSparks.id, id), live(now), activeAuthor()))
    .limit(1);
  return row ?? null;
}

export async function countLiveOwnSparks(userId: string, now: Date): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(voiceSparks)
    .where(and(eq(voiceSparks.userId, userId), isNull(voiceSparks.replyToId), live(now)));
  return row?.total ?? 0;
}

export async function findLatestOwnSpark(userId: string, now: Date): Promise<SparkRow | null> {
  const [row] = await selectSparks()
    .where(and(eq(voiceSparks.userId, userId), isNull(voiceSparks.replyToId), live(now)))
    .orderBy(desc(voiceSparks.createdAt))
    .limit(1);
  return row ?? null;
}

export async function countLiveReplies(sparkId: string, viewerId: string, now: Date): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(voiceSparks)
    .innerJoin(users, eq(users.id, voiceSparks.userId))
    .where(
      and(
        eq(voiceSparks.replyToId, sparkId),
        live(now),
        activeAuthor(),
        notBlockedBetween(viewerId, voiceSparks.userId),
      ),
    );
  return row?.total ?? 0;
}

/** Language ids the viewer speaks or learns; the feed keeps to those when there are any. */
export async function viewerLanguageIds(viewerId: string): Promise<string[]> {
  const rows = await db
    .select({ languageId: userLanguages.languageId })
    .from(userLanguages)
    .where(eq(userLanguages.userId, viewerId));
  return [...new Set(rows.map((row) => row.languageId))];
}

/**
 * Newest live public spark of each other member, newest first. Authors are visible the way
 * Discover shows them: active, onboarded, discoverable, no block either way.
 */
export async function listFeed(viewerId: string, languageIds: string[], now: Date, limit: number) {
  const conditions: (SQL | undefined)[] = [
    live(now),
    isNull(voiceSparks.replyToId),
    activeAuthor(),
    eq(profiles.discoverable, true),
    ne(voiceSparks.userId, viewerId),
    notBlockedBetween(viewerId, voiceSparks.userId),
  ];
  if (languageIds.length > 0) {
    conditions.push(inArray(voiceSparks.languageId, languageIds));
  }

  const rows = await selectSparks()
    .where(and(...conditions))
    .orderBy(desc(voiceSparks.createdAt), desc(voiceSparks.id))
    .limit(FEED_WINDOW);

  const seen = new Set<string>();
  const newestPerAuthor: SparkRow[] = [];
  for (const row of rows) {
    if (seen.has(row.userId)) continue;
    seen.add(row.userId);
    newestPerAuthor.push(row);
    if (newestPerAuthor.length >= limit) break;
  }
  return newestPerAuthor;
}

/** Live voice replies to the viewer's sparks, newest first. */
export async function listRepliesTo(viewerId: string, now: Date, limit: number): Promise<SparkRow[]> {
  return selectSparks()
    .where(
      and(
        eq(voiceSparks.replyToUserId, viewerId),
        live(now),
        activeAuthor(),
        notBlockedBetween(viewerId, voiceSparks.userId),
      ),
    )
    .orderBy(desc(voiceSparks.createdAt), desc(voiceSparks.id))
    .limit(limit);
}

export async function deleteOwnSpark(userId: string, id: string): Promise<boolean> {
  const deleted = await db
    .delete(voiceSparks)
    .where(and(eq(voiceSparks.id, id), eq(voiceSparks.userId, userId)))
    .returning({ id: voiceSparks.id });
  return deleted.length > 0;
}

/** Removes expired sparks and the replies to them; returns every author whose audio was freed. */
export async function deleteExpiredSparks(now: Date): Promise<string[]> {
  const expired = db.select({ id: voiceSparks.id }).from(voiceSparks).where(lt(voiceSparks.expiresAt, now));
  const deleted = await db
    .delete(voiceSparks)
    .where(or(lt(voiceSparks.expiresAt, now), inArray(voiceSparks.replyToId, expired)))
    .returning({ userId: voiceSparks.userId });
  return [...new Set(deleted.map((row) => row.userId))];
}
