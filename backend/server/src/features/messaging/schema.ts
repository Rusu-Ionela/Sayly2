import { z } from "zod";

import { boundedIdSchema } from "../../shared/validation/text";

export const MESSAGE_TYPES = ["TEXT", "IMAGE", "VOICE", "VIDEO"] as const;
export const DEFAULT_CONVERSATION_LIMIT = 20;
export const DEFAULT_MESSAGE_LIMIT = 30;

export const sendMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1)
    .max(4000)
    .refine((value) => !value.includes("\u0000"), "Invalid characters"),
  type: z.enum(MESSAGE_TYPES).optional(),
  durationMs: z.number().min(0).max(600_000).transform((value) => Math.round(value)).optional(),
  mimeType: z.string().max(120).optional(),
  thumbnailUrl: z.string().max(2000).optional(),
  caption: z
    .string()
    .trim()
    .max(1000)
    .refine((value) => !value.includes("\u0000"), "Invalid characters")
    .optional(),
  clientMessageId: z.string().trim().min(8).max(80).optional(),
});

export const sendMessageEventSchema = sendMessageSchema.extend({
  conversationId: boundedIdSchema,
});

export const messageReadEventSchema = z.object({
  conversationId: boundedIdSchema,
  messageIds: z.array(boundedIdSchema).max(100).optional(),
});

export const conversationIdEventSchema = z.object({
  conversationId: boundedIdSchema,
});

export const userOnlineStatusEventSchema = z.object({
  userId: boundedIdSchema,
});

export const listConversationsQuerySchema = z.object({
  cursor: z.string().min(1).max(256).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(DEFAULT_CONVERSATION_LIMIT),
});

export const listMessagesQuerySchema = z.object({
  before: boundedIdSchema.optional(),
  page: z.coerce.number().int().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_MESSAGE_LIMIT),
});

export const openDirectConversationSchema = z.object({ userId: boundedIdSchema });
