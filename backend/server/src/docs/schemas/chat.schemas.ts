import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const MessageTypeSchema = z.enum(["TEXT", "IMAGE", "VOICE", "VIDEO"]).openapi({ example: "TEXT" });
export const MessageStatusSchema = z.enum(["SENT", "DELIVERED", "READ"]).openapi({ example: "SENT" });
export const OnlineStatusSchema = z.enum(["ONLINE", "OFFLINE", "UNKNOWN"]).openapi({ example: "OFFLINE" });

export const OpenDirectConversationRequestSchema = z
  .object({ userId: z.string().openapi({ example: "clxyz...", description: "User to chat with" }) })
  .openapi("OpenDirectConversationRequest");

export const OpenDirectConversationResponseSchema = z
  .object({ conversationId: z.string().openapi({ example: "clconv..." }) })
  .openapi("OpenDirectConversationResponse");

export const ChatMessageSchema = z
  .object({
    id: z.string().openapi({ example: "clmsg..." }),
    conversationId: z.string().openapi({ example: "clconv..." }),
    senderId: z.string().openapi({ example: "cluser..." }),
    type: MessageTypeSchema,
    content: z.string().openapi({ example: "Hi! Want to practice today?" }),
    status: MessageStatusSchema,
    durationMs: z.number().int().nullable().optional(),
    mimeType: z.string().nullable().optional(),
    thumbnailUrl: z.string().nullable().optional(),
    transcript: z.string().nullable().optional(),
    translatedContent: z.string().nullable().optional(),
    translatedLang: z.string().nullable().optional(),
    caption: z.string().nullable().optional(),
    createdAt: z.string().openapi({ example: "2026-09-07T10:00:00.000Z" }),
    updatedAt: z.string().openapi({ example: "2026-09-07T10:00:00.000Z" }),
  })
  .openapi("ChatMessage");

export const ChatPartnerSchema = z
  .object({
    id: z.string(),
    displayName: z.string().openapi({ example: "Maria" }),
    avatarUrl: z.string().nullable(),
    photoUrl: z.string().optional(),
    country: z.string().openapi({ example: "RO" }),
    onlineStatus: OnlineStatusSchema,
    lastSeen: z.string().nullable(),
  })
  .openapi("ChatPartner");

export const ConversationListItemSchema = z
  .object({
    id: z.string().openapi({ example: "clconv..." }),
    type: z.literal("DIRECT"),
    otherUser: ChatPartnerSchema,
    lastMessage: ChatMessageSchema.nullable(),
    unreadCount: z.number().int(),
    lastMessageAt: z.string().nullable(),
    updatedAt: z.string(),
  })
  .openapi("ConversationListItem");

export const ConversationsPageSchema = z
  .object({
    items: z.array(ConversationListItemSchema),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
    limit: z.number().int(),
  })
  .openapi("ConversationsPage");

export const MessagesPageSchema = z
  .object({
    items: z.array(ChatMessageSchema),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
    limit: z.number().int(),
    page: z.number().int().optional(),
    total: z.number().int().optional(),
  })
  .openapi("MessagesPage");

export const SendMessageRequestSchema = z
  .object({
    content: z.string().min(1).max(4000).openapi({ example: "Salut!" }),
    type: MessageTypeSchema.optional(),
    durationMs: z.number().int().optional(),
    mimeType: z.string().optional(),
    thumbnailUrl: z.string().optional(),
    caption: z.string().max(1000).optional(),
  })
  .openapi("SendMessageRequest");

export const TranslateMessageRequestSchema = z
  .object({
    targetLang: z.string().min(2).max(8).optional().openapi({ example: "ro" }),
  })
  .openapi("TranslateMessageRequest");

export const ConversationMessageParamSchema = z
  .object({
    id: z.string().min(1).openapi({ example: "clconv..." }),
    messageId: z.string().min(1).openapi({ example: "clmsg..." }),
  })
  .openapi("ConversationMessageParam");

export const MediaUploadResultSchema = z
  .object({
    url: z.string(),
    mimeType: z.string(),
    kind: z.enum(["image", "audio", "video"]),
    size: z.number().int(),
  })
  .openapi("MediaUploadResult");

export const MediaUploadRequestSchema = z
  .object({
    file: z.string().openapi({ format: "binary" }),
  })
  .openapi("MediaUploadRequest");

export const MarkReadResponseSchema = z
  .object({
    conversationId: z.string(),
    messages: z.array(ChatMessageSchema),
    readCount: z.number().int(),
  })
  .openapi("MarkReadResponse");

export const ConversationIdParamSchema = z
  .object({
    id: z.string().min(1).openapi({ example: "clconv..." }),
  })
  .openapi("ConversationIdParam");

export const ListConversationsQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .openapi("ListConversationsQuery");

export const ListMessagesQuerySchema = z
  .object({
    before: z.string().optional().openapi({ description: "Message id cursor; returns older messages." }),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .openapi("ListMessagesQuery");
