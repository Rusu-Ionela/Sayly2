import { z } from "zod";

export const MessageTypeSchema = z.enum(["TEXT", "IMAGE", "VOICE", "VIDEO"]).meta({ example: "TEXT" });
export const MessageStatusSchema = z.enum(["SENT", "DELIVERED", "READ"]).meta({ example: "SENT" });
export const OnlineStatusSchema = z.enum(["ONLINE", "OFFLINE", "UNKNOWN"]).meta({ example: "OFFLINE" });

export const OpenDirectConversationRequestSchema = z
  .object({ userId: z.string().meta({ example: "clxyz...", description: "User to chat with" }) })
  .meta({ id: "OpenDirectConversationRequest" });

export const OpenDirectConversationResponseSchema = z
  .object({ conversationId: z.string().meta({ example: "clconv..." }) })
  .meta({ id: "OpenDirectConversationResponse" });

export const ChatMessageSchema = z
  .object({
    id: z.string().meta({ example: "clmsg..." }),
    conversationId: z.string().meta({ example: "clconv..." }),
    senderId: z.string().meta({ example: "cluser..." }),
    type: MessageTypeSchema,
    content: z.string().meta({ example: "Hi! Want to practice today?" }),
    status: MessageStatusSchema,
    durationMs: z.number().int().nullable().optional(),
    mimeType: z.string().nullable().optional(),
    thumbnailUrl: z.string().nullable().optional(),
    transcript: z.string().nullable().optional(),
    translatedContent: z.string().nullable().optional(),
    translatedLang: z.string().nullable().optional(),
    caption: z.string().nullable().optional(),
    createdAt: z.string().meta({ example: "2026-09-07T10:00:00.000Z" }),
    updatedAt: z.string().meta({ example: "2026-09-07T10:00:00.000Z" }),
  })
  .meta({ id: "ChatMessage" });

export const ChatPartnerSchema = z
  .object({
    id: z.string(),
    displayName: z.string().meta({ example: "Maria" }),
    avatarUrl: z.string().nullable(),
    photoUrl: z.string().optional(),
    country: z.string().meta({ example: "RO" }),
    onlineStatus: OnlineStatusSchema,
    lastSeen: z.string().nullable(),
  })
  .meta({ id: "ChatPartner" });

export const ConversationListItemSchema = z
  .object({
    id: z.string().meta({ example: "clconv..." }),
    type: z.literal("DIRECT"),
    otherUser: ChatPartnerSchema,
    lastMessage: ChatMessageSchema.nullable(),
    unreadCount: z.number().int(),
    lastMessageAt: z.string().nullable(),
    updatedAt: z.string(),
  })
  .meta({ id: "ConversationListItem" });

export const ConversationsPageSchema = z
  .object({
    items: z.array(ConversationListItemSchema),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
    limit: z.number().int(),
  })
  .meta({ id: "ConversationsPage" });

export const MessagesPageSchema = z
  .object({
    items: z.array(ChatMessageSchema),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
    limit: z.number().int(),
    page: z.number().int().optional(),
    total: z.number().int().optional(),
  })
  .meta({ id: "MessagesPage" });

export const SendMessageRequestSchema = z
  .object({
    content: z.string().min(1).max(4000).meta({ example: "Salut!" }),
    type: MessageTypeSchema.optional(),
    durationMs: z.number().int().optional(),
    mimeType: z.string().optional(),
    thumbnailUrl: z.string().optional(),
    caption: z.string().max(1000).optional(),
  })
  .meta({ id: "SendMessageRequest" });

export const TranslateMessageRequestSchema = z
  .object({
    targetLang: z.string().min(2).max(8).optional().meta({ example: "ro" }),
  })
  .meta({ id: "TranslateMessageRequest" });

export const ConversationMessageParamSchema = z
  .object({
    id: z.string().min(1).meta({ example: "clconv..." }),
    messageId: z.string().min(1).meta({ example: "clmsg..." }),
  })
  .meta({ id: "ConversationMessageParam" });

export const MediaUploadResultSchema = z
  .object({
    url: z.string(),
    mimeType: z.string(),
    kind: z.enum(["image", "audio", "video"]),
    size: z.number().int(),
  })
  .meta({ id: "MediaUploadResult" });

export const MediaUploadRequestSchema = z
  .object({
    file: z.string().meta({ format: "binary" }),
  })
  .meta({ id: "MediaUploadRequest" });

export const MarkReadResponseSchema = z
  .object({
    conversationId: z.string(),
    messages: z.array(ChatMessageSchema),
    readCount: z.number().int(),
  })
  .meta({ id: "MarkReadResponse" });

export const ConversationIdParamSchema = z
  .object({
    id: z.string().min(1).meta({ example: "clconv..." }),
  })
  .meta({ id: "ConversationIdParam" });

export const ListConversationsQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .meta({ id: "ListConversationsQuery" });

export const ListMessagesQuerySchema = z
  .object({
    before: z.string().optional().meta({ description: "Message id cursor; returns older messages." }),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .meta({ id: "ListMessagesQuery" });
