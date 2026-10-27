import { z } from "zod";

import { languageIdSchema } from "./icebreakers";

/** A spark is a short voice note; the app stops recording at the limit. */
export const VOICE_SPARK_MIN_MS = 1_000;
export const VOICE_SPARK_MAX_MS = 15_000;
/** Sparks disappear this long after they were posted. */
export const VOICE_SPARK_TTL_HOURS = 24;
/** Fits 15 s of AAC easily, and 15 s of the mono 48 kHz WAV the web app records (~1.4 MB). */
export const VOICE_SPARK_MAX_BYTES = 2_000_000;
export const VOICE_SPARK_FEED_LIMIT = 30;

/**
 * POST /voicesparks. `audioUrl` is the path returned by POST /media/uploads.
 * With `replyToId`, the spark is a private voice reply that only the author of that spark hears.
 */
export const createVoiceSparkSchema = z
  .object({
    audioUrl: z.string().trim().min(1).max(512),
    durationMs: z.number().int().min(VOICE_SPARK_MIN_MS).max(VOICE_SPARK_MAX_MS),
    languageId: languageIdSchema,
    replyToId: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export type CreateVoiceSparkInput = z.infer<typeof createVoiceSparkSchema>;

export type VoiceSparkAuthorDto = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

export type VoiceSparkDto = {
  id: string;
  author: VoiceSparkAuthorDto;
  languageId: string;
  languageName: string;
  flagEmoji: string | null;
  /** Short-lived signed URL, ready to play. */
  audioUrl: string;
  durationMs: number;
  createdAt: string;
  expiresAt: string;
  /** Set on voice replies: the spark this answers. */
  replyToId: string | null;
  /** Replies to this spark; only filled in for the viewer's own sparks. */
  replyCount: number;
};

export type VoiceSparkFeedDto = {
  /** The viewer's newest live spark, if any. */
  mine: VoiceSparkDto | null;
  /** Newest live spark of each other member, newest first. */
  items: VoiceSparkDto[];
  /** Voice replies others sent to the viewer's sparks, newest first. */
  replies: VoiceSparkDto[];
};
