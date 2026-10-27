import { z } from "zod";

import { languageIdSchema } from "./icebreakers";

/** Instants: photo, voice or text posts that disappear 24 hours after they go up. */
export const STORY_MEDIA_TYPES = ["PHOTO", "VOICE", "TEXT"] as const;
export type StoryMediaType = (typeof STORY_MEDIA_TYPES)[number];

export const STORY_TTL_HOURS = 24;
/** Live stories one member may have at once. */
export const STORY_MAX_LIVE = 10;
export const STORY_TEXT_MAX = 500;
export const STORY_CAPTION_MAX = 200;
export const STORY_REPLY_MAX = 1000;
export const STORY_VOICE_MIN_MS = 1_000;
export const STORY_VOICE_MAX_MS = 30_000;
/** 30 s of AAC fits easily; 30 s of the web app's mono 48 kHz WAV is ~2.9 MB. */
export const STORY_VOICE_MAX_BYTES = 3_500_000;
export const STORY_PHOTO_MAX_BYTES = 8_000_000;
/** How long a photo or text story stays on screen before the next one. */
export const STORY_STILL_DURATION_MS = 5_000;
/** Authors returned by GET /stories/feed. */
export const STORY_FEED_AUTHOR_LIMIT = 50;

const noNul = (value: string) => !value.includes("\u0000");

const mediaUrlSchema = z.string().trim().min(1).max(512);
const captionSchema = z
  .string()
  .trim()
  .max(STORY_CAPTION_MAX)
  .refine(noNul, "Invalid characters")
  .optional();

/**
 * POST /stories. `mediaUrl` is the path returned by POST /media/uploads (PHOTO, VOICE).
 * TEXT stories carry their words in `textContent`; on a PHOTO it is an optional caption.
 */
export const createStorySchema = z.discriminatedUnion("mediaType", [
  z
    .object({
      mediaType: z.literal("PHOTO"),
      mediaUrl: mediaUrlSchema,
      textContent: captionSchema,
      targetLanguage: languageIdSchema,
    })
    .strict(),
  z
    .object({
      mediaType: z.literal("VOICE"),
      mediaUrl: mediaUrlSchema,
      durationMs: z.number().int().min(STORY_VOICE_MIN_MS).max(STORY_VOICE_MAX_MS),
      targetLanguage: languageIdSchema,
    })
    .strict(),
  z
    .object({
      mediaType: z.literal("TEXT"),
      textContent: z.string().trim().min(1).max(STORY_TEXT_MAX).refine(noNul, "Invalid characters"),
      targetLanguage: languageIdSchema,
    })
    .strict(),
]);

export type CreateStoryInput = z.infer<typeof createStorySchema>;

/** POST /stories/:id/reply — lands in the private chat with the author. */
export const storyReplySchema = z
  .object({
    text: z.string().trim().min(1).max(STORY_REPLY_MAX).refine(noNul, "Invalid characters"),
    clientMessageId: z.string().trim().min(8).max(80).optional(),
  })
  .strict();

export type StoryReplyInput = z.infer<typeof storyReplySchema>;

export type StoryAuthorDto = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

export type StoryDto = {
  id: string;
  authorId: string;
  mediaType: StoryMediaType;
  /** Short-lived signed URL for PHOTO and VOICE; null for TEXT. */
  mediaUrl: string | null;
  textContent: string | null;
  durationMs: number | null;
  targetLanguage: string;
  languageName: string;
  flagEmoji: string | null;
  createdAt: string;
  expiresAt: string;
};

/** One author's live stories, oldest first so they play in the order they were posted. */
export type StoryGroupDto = {
  author: StoryAuthorDto;
  stories: StoryDto[];
};

export type StoryFeedDto = {
  /** The viewer's own live stories, or null when there are none. */
  mine: StoryGroupDto | null;
  /** Connections and people the viewer follows, the most recent poster first. */
  groups: StoryGroupDto[];
};

export type StoryReplyResultDto = {
  conversationId: string;
  messageId: string;
};
