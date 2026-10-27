import {
  STORY_FEED_AUTHOR_LIMIT,
  STORY_MAX_LIVE,
  STORY_PHOTO_MAX_BYTES,
  STORY_TTL_HOURS,
  STORY_VOICE_MAX_BYTES,
  type CreateStoryInput,
  type StoryDto,
  type StoryFeedDto,
  type StoryGroupDto,
  type StoryReplyInput,
  type StoryReplyResultDto,
} from "@sayly/shared";

import { AppError } from "../../shared/errors/AppError";
import { logger } from "../../shared/utils/logger";
import { normalizeLanguageCode } from "../languages/catalog";
import { findOwnedAsset, reclaimOwnerMedia } from "../media/service";
import { resignMediaUrl, stableFilePath } from "../media/storage";
import { emitNewMessage } from "../messaging/gateway";
import * as messagingService from "../messaging/service";
import { promoteDelivered } from "../messaging/socket";
import { notifyNewMessage } from "../notifications";
import { recordActivityInBackground } from "../streaks";

import * as repository from "./repository";

const TTL_MS = STORY_TTL_HOURS * 60 * 60 * 1000;
const EXPIRED = () => new AppError("This story has expired", 404, "NOT_FOUND");

function signed(url: string | null): string | null {
  return url ? (resignMediaUrl(url) ?? url) : null;
}

export function toStoryDto(row: repository.StoryRow): StoryDto {
  return {
    id: row.id,
    authorId: row.userId,
    mediaType: row.mediaType,
    mediaUrl: signed(row.mediaUrl),
    textContent: row.textContent,
    durationMs: row.durationMs,
    targetLanguage: row.targetLanguage,
    languageName: row.languageName,
    flagEmoji: row.flagEmoji || null,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

/** Rows arrive oldest first; groups keep that order inside and put the latest poster first. */
export function groupByAuthor(rows: repository.StoryRow[], limit: number): StoryGroupDto[] {
  const groups = new Map<string, { group: StoryGroupDto; latest: number }>();
  for (const row of rows) {
    let entry = groups.get(row.userId);
    if (!entry) {
      entry = {
        group: {
          author: { id: row.userId, displayName: row.displayName, avatarUrl: signed(row.profileImageUrl) },
          stories: [],
        },
        latest: 0,
      };
      groups.set(row.userId, entry);
    }
    entry.group.stories.push(toStoryDto(row));
    entry.latest = Math.max(entry.latest, row.createdAt.getTime());
  }
  return [...groups.values()]
    .sort((a, b) => b.latest - a.latest)
    .slice(0, limit)
    .map((entry) => entry.group);
}

/** The upload must be the member's own file, of the right kind and size; returns its stable path. */
async function requireStoryMedia(userId: string, mediaUrl: string, kind: "image" | "audio") {
  const asset = await findOwnedAsset(userId, mediaUrl);
  if (!asset || !asset.mimeType.startsWith(`${kind}/`)) {
    throw new AppError(kind === "image" ? "Choose a photo first" : "Record a voice note first", 400, "VALIDATION_ERROR");
  }
  const maxBytes = kind === "image" ? STORY_PHOTO_MAX_BYTES : STORY_VOICE_MAX_BYTES;
  if (asset.size > maxBytes) {
    throw new AppError("This file is too large for a story", 400, "VALIDATION_ERROR");
  }
  return stableFilePath(asset.storageKey);
}

export async function createStory(userId: string, input: CreateStoryInput): Promise<StoryDto> {
  const targetLanguage = normalizeLanguageCode(input.targetLanguage);
  if (!targetLanguage) {
    throw new AppError("Unknown language", 400, "VALIDATION_ERROR");
  }
  const now = new Date();
  if ((await repository.countLiveOwnStories(userId, now)) >= STORY_MAX_LIVE) {
    throw new AppError(
      `You can have ${STORY_MAX_LIVE} stories at a time. Delete one or wait until one expires.`,
      409,
      "CONFLICT",
    );
  }

  const base = { userId, targetLanguage, createdAt: now, expiresAt: new Date(now.getTime() + TTL_MS) };
  let values: repository.NewStory;
  switch (input.mediaType) {
    case "PHOTO":
      values = {
        ...base,
        mediaType: "PHOTO",
        mediaUrl: await requireStoryMedia(userId, input.mediaUrl, "image"),
        textContent: input.textContent || null,
        durationMs: null,
      };
      break;
    case "VOICE":
      values = {
        ...base,
        mediaType: "VOICE",
        mediaUrl: await requireStoryMedia(userId, input.mediaUrl, "audio"),
        textContent: null,
        durationMs: input.durationMs,
      };
      break;
    case "TEXT":
      values = { ...base, mediaType: "TEXT", mediaUrl: null, textContent: input.textContent, durationMs: null };
      break;
  }

  const id = await repository.insertStory(values);
  const saved = await repository.findOwnStory(userId, id, now);
  if (!saved) {
    throw new AppError("Story was not saved", 500, "INTERNAL_ERROR");
  }
  recordActivityInBackground(userId);
  return toStoryDto(saved);
}

export async function getFeed(viewerId: string, now: Date = new Date()): Promise<StoryFeedDto> {
  const [ownRows, feedRows] = await Promise.all([
    repository.listOwnLiveStories(viewerId, now),
    repository.listFeedStories(viewerId, now),
  ]);
  return {
    mine: groupByAuthor(ownRows, 1)[0] ?? null,
    groups: groupByAuthor(feedRows, STORY_FEED_AUTHOR_LIMIT),
  };
}

/** First line of a story reply in chat, so the author knows which story it answers. */
export function storyReplyContent(story: repository.StoryRow, text: string): string {
  let quote: string;
  if (story.mediaType === "TEXT" && story.textContent) {
    const excerpt = story.textContent.length > 60 ? `${story.textContent.slice(0, 60).trimEnd()}…` : story.textContent;
    quote = `↪ Replied to your story: “${excerpt}”`;
  } else {
    quote = story.mediaType === "PHOTO" ? "↪ Replied to your photo story" : "↪ Replied to your voice story";
  }
  return `${quote}\n${text}`;
}

/**
 * Sends the reply as a text message into the private chat with the author. Opening a new chat
 * still needs an accepted connection (a follow alone is not enough), as everywhere else.
 */
export async function replyToStory(
  viewerId: string,
  storyId: string,
  input: StoryReplyInput,
): Promise<StoryReplyResultDto> {
  const story = await repository.findVisibleStory(viewerId, storyId, new Date());
  if (!story) throw EXPIRED();
  if (story.userId === viewerId) {
    throw new AppError("You cannot reply to your own story", 400, "VALIDATION_ERROR");
  }

  const { conversationId } = await messagingService.getOrCreateDirectConversation(viewerId, story.userId);
  const result = await messagingService.sendMessage(viewerId, {
    conversationId,
    content: storyReplyContent(story, input.text),
    type: "TEXT",
    clientMessageId: input.clientMessageId,
  });

  if (result.created) {
    emitNewMessage(result.message, result.recipientId);
    notifyNewMessage(result.message, result.recipientId);
    void promoteDelivered(viewerId, result.recipientId, conversationId, result.message.id);
  }
  return { conversationId, messageId: result.message.id };
}

export async function deleteStory(userId: string, id: string) {
  const deleted = await repository.deleteOwnStory(userId, id);
  if (!deleted) {
    throw new AppError("Story not found", 404, "NOT_FOUND");
  }
  return { deleted };
}

/** Deletes expired stories, then frees their photos and audio. */
export async function sweepExpiredStories(now: Date = new Date()) {
  const authors = await repository.deleteExpiredStories(now);
  for (const authorId of authors) {
    await reclaimOwnerMedia(authorId).catch((error: unknown) =>
      logger.warn("stories", "media reclaim failed", {
        authorId,
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    );
  }
  return authors.length;
}

const SWEEP_EVERY_MS = 10 * 60 * 1000;

/** Runs the expiry sweep at start and then every 10 minutes; returns a stop function. */
export function startStoryCleanupJob(): () => void {
  const run = () =>
    void sweepExpiredStories().catch((error: unknown) =>
      logger.warn("stories", "expiry sweep failed", {
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    );
  run();
  const timer = setInterval(run, SWEEP_EVERY_MS);
  timer.unref();
  return () => clearInterval(timer);
}
