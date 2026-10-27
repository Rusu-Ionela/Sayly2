import {
  VOICE_SPARK_FEED_LIMIT,
  VOICE_SPARK_MAX_BYTES,
  VOICE_SPARK_TTL_HOURS,
  type CreateVoiceSparkInput,
  type VoiceSparkDto,
  type VoiceSparkFeedDto,
} from "@sayly/shared";

import { AppError } from "../../shared/errors/AppError";
import { logger } from "../../shared/utils/logger";
import { normalizeLanguageCode } from "../languages/catalog";
import { findOwnedAsset, reclaimOwnerMedia } from "../media/service";
import { resignMediaUrl, stableFilePath } from "../media/storage";
import { emitToUsers } from "../messaging/gateway";
import { isBlockedEitherWay } from "../safety/repository";
import { recordActivityInBackground } from "../streaks";

import * as repository from "./repository";

const TTL_MS = VOICE_SPARK_TTL_HOURS * 60 * 60 * 1000;
/** Live public sparks one member may have at once; replies do not count. */
export const MAX_LIVE_SPARKS = 5;

export const VOICE_SPARK_EVENTS = { reply: "voice_spark_reply" } as const;

export function toSparkDto(row: repository.SparkRow, replyCount = 0): VoiceSparkDto {
  const avatar = row.profileImageUrl;
  return {
    id: row.id,
    author: {
      id: row.userId,
      displayName: row.displayName,
      avatarUrl: avatar ? (resignMediaUrl(avatar) ?? avatar) : null,
    },
    languageId: row.languageId,
    languageName: row.languageName,
    flagEmoji: row.flagEmoji || null,
    audioUrl: resignMediaUrl(row.audioUrl) ?? row.audioUrl,
    durationMs: row.durationMs,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    replyToId: row.replyToId,
    replyCount,
  };
}

/** The upload must be the member's own audio file, and small enough to be a short note. */
async function requireSparkAudio(userId: string, audioUrl: string): Promise<string> {
  const asset = await findOwnedAsset(userId, audioUrl);
  if (!asset || !asset.mimeType.startsWith("audio/")) {
    throw new AppError("Record a voice note first", 400, "VALIDATION_ERROR");
  }
  if (asset.size > VOICE_SPARK_MAX_BYTES) {
    throw new AppError("Voice Sparks are at most 15 seconds long", 400, "VALIDATION_ERROR");
  }
  return stableFilePath(asset.storageKey);
}

export async function createSpark(userId: string, input: CreateVoiceSparkInput): Promise<VoiceSparkDto> {
  const languageId = normalizeLanguageCode(input.languageId);
  if (!languageId) {
    throw new AppError("Unknown language", 400, "VALIDATION_ERROR");
  }
  const now = new Date();

  let replyToUserId: string | null = null;
  if (input.replyToId) {
    const target = await repository.findLiveSpark(input.replyToId, now);
    if (!target || target.replyToId) {
      throw new AppError("This Voice Spark has expired", 404, "NOT_FOUND");
    }
    if (target.userId === userId) {
      throw new AppError("You cannot reply to your own Voice Spark", 400, "VALIDATION_ERROR");
    }
    if (await isBlockedEitherWay(userId, target.userId)) {
      throw new AppError("This Voice Spark has expired", 404, "NOT_FOUND");
    }
    replyToUserId = target.userId;
  } else if ((await repository.countLiveOwnSparks(userId, now)) >= MAX_LIVE_SPARKS) {
    throw new AppError(
      `You can have ${MAX_LIVE_SPARKS} Voice Sparks at a time. Delete one or wait until one expires.`,
      409,
      "CONFLICT",
    );
  }

  const audioUrl = await requireSparkAudio(userId, input.audioUrl);
  const id = await repository.insertSpark({
    userId,
    languageId,
    audioUrl,
    durationMs: input.durationMs,
    replyToId: input.replyToId ?? null,
    replyToUserId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + TTL_MS),
  });

  const saved = await repository.findLiveSpark(id, now);
  if (!saved) {
    throw new AppError("Voice spark was not saved", 500, "INTERNAL_ERROR");
  }
  const dto = toSparkDto(saved);
  recordActivityInBackground(userId);
  if (replyToUserId) {
    emitToUsers([replyToUserId], VOICE_SPARK_EVENTS.reply, dto);
  }
  return dto;
}

export async function getFeed(viewerId: string, now: Date = new Date()): Promise<VoiceSparkFeedDto> {
  const languageIds = await repository.viewerLanguageIds(viewerId);
  const [mineRow, items, replies] = await Promise.all([
    repository.findLatestOwnSpark(viewerId, now),
    repository.listFeed(viewerId, languageIds, now, VOICE_SPARK_FEED_LIMIT),
    repository.listRepliesTo(viewerId, now, VOICE_SPARK_FEED_LIMIT),
  ]);
  const mine = mineRow
    ? toSparkDto(mineRow, await repository.countLiveReplies(mineRow.id, viewerId, now))
    : null;
  return {
    mine,
    items: items.map((row) => toSparkDto(row)),
    replies: replies.map((row) => toSparkDto(row)),
  };
}

export async function deleteSpark(userId: string, id: string) {
  const deleted = await repository.deleteOwnSpark(userId, id);
  if (!deleted) {
    throw new AppError("Voice spark not found", 404, "NOT_FOUND");
  }
  return { deleted };
}

/** Deletes expired sparks, then frees their audio files. */
export async function sweepExpiredSparks(now: Date = new Date()) {
  const authors = await repository.deleteExpiredSparks(now);
  for (const authorId of authors) {
    await reclaimOwnerMedia(authorId).catch((error: unknown) =>
      logger.warn("voiceSparks", "media reclaim failed", {
        authorId,
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    );
  }
  return authors.length;
}

const SWEEP_EVERY_MS = 10 * 60 * 1000;

/** Runs the expiry sweep at start and then every 10 minutes; returns a stop function. */
export function startVoiceSparkCleanupJob(): () => void {
  const run = () =>
    void sweepExpiredSparks().catch((error: unknown) =>
      logger.warn("voiceSparks", "expiry sweep failed", {
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    );
  run();
  const timer = setInterval(run, SWEEP_EVERY_MS);
  timer.unref();
  return () => clearInterval(timer);
}
