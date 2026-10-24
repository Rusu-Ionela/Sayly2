import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import { bearerAuth, commonErrorResponses } from "../components/responses";
import { ForbiddenErrorSchema } from "../schemas/error.schemas";
import {
  ChatMessageSchema,
  ConversationIdParamSchema,
  ConversationMessageParamSchema,
  ConversationsPageSchema,
  ListConversationsQuerySchema,
  ListMessagesQuerySchema,
  MarkReadResponseSchema,
  MediaUploadRequestSchema,
  MediaUploadResultSchema,
  MessagesPageSchema,
  OpenDirectConversationRequestSchema,
  OpenDirectConversationResponseSchema,
  SendMessageRequestSchema,
  TranslateMessageRequestSchema,
} from "../schemas/chat.schemas";

const forbidden = {
  description: "Conversation unavailable",
  content: {
    "application/json": {
      schema: ForbiddenErrorSchema,
    },
  },
};

const conversationIdParams = {
  params: ConversationIdParamSchema,
};

export function registerChatPaths(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/conversations",
    tags: ["Chat"],
    summary: "List chat inbox",
    description:
      "CHAT-001. Returns the authenticated user's DIRECT conversations ordered by lastMessageAt DESC. " +
      "Includes partner profile, last message, unread count, and online status. Cursor-paginated.",
    security: bearerAuth,
    request: {
      query: ListConversationsQuerySchema,
    },
    responses: {
      200: {
        description: "Paginated conversation list",
        content: {
          "application/json": {
            schema: ConversationsPageSchema,
          },
        },
      },
      401: commonErrorResponses[401]!,
      500: commonErrorResponses[500]!,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/conversations/direct",
    tags: ["Chat"],
    summary: "Open a direct chat with a user",
    description:
      "Returns the one-to-one conversation with the target user, creating it on first use. " +
      "No request or acceptance step. Responds 404 when the user is unavailable, has blocked you, " +
      "or hides from Community and you have no chat yet.",
    security: bearerAuth,
    request: {
      body: {
        content: { "application/json": { schema: OpenDirectConversationRequestSchema } },
      },
    },
    responses: {
      200: {
        description: "Existing conversation",
        content: { "application/json": { schema: OpenDirectConversationResponseSchema } },
      },
      201: {
        description: "Conversation created",
        content: { "application/json": { schema: OpenDirectConversationResponseSchema } },
      },
      400: commonErrorResponses[400]!,
      401: commonErrorResponses[401]!,
      404: commonErrorResponses[404]!,
      500: commonErrorResponses[500]!,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/conversations/{id}/messages",
    tags: ["Chat"],
    summary: "List conversation messages",
    description:
      "CHAT-002. Returns a page of messages for a conversation the user belongs to. " +
      "Prefer cursor pagination with `before` (message id). Offset `page` remains supported.",
    security: bearerAuth,
    request: {
      params: ConversationIdParamSchema,
      query: ListMessagesQuerySchema,
    },
    responses: {
      200: {
        description: "Paginated messages (latest page, chronological within the page)",
        content: {
          "application/json": {
            schema: MessagesPageSchema,
          },
        },
      },
      400: commonErrorResponses[400]!,
      401: commonErrorResponses[401]!,
      403: forbidden,
      404: commonErrorResponses[404]!,
      500: commonErrorResponses[500]!,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/conversations/{id}/messages",
    tags: ["Chat"],
    summary: "Send a message (HTTP fallback)",
    description:
      "Persists a TEXT/IMAGE/VOICE/VIDEO message atomically, updates conversation lastMessageAt, " +
      "and emits message_new over Socket.IO. Requires no block between the two users. " +
      "Upload files first with POST /media/uploads, then send the returned URL as content.",
    security: bearerAuth,
    request: {
      ...conversationIdParams,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: SendMessageRequestSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Message stored",
        content: {
          "application/json": {
            schema: ChatMessageSchema,
          },
        },
      },
      400: commonErrorResponses[400]!,
      401: commonErrorResponses[401]!,
      403: forbidden,
      404: commonErrorResponses[404]!,
      429: commonErrorResponses[429]!,
      500: commonErrorResponses[500]!,
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/conversations/{id}/read",
    tags: ["Chat"],
    summary: "Mark conversation as read",
    description:
      "Marks all unread inbound messages as READ and emits message_status to the partner.",
    security: bearerAuth,
    request: conversationIdParams,
    responses: {
      200: {
        description: "Messages marked read",
        content: {
          "application/json": {
            schema: MarkReadResponseSchema,
          },
        },
      },
      401: commonErrorResponses[401]!,
      403: forbidden,
      404: commonErrorResponses[404]!,
      500: commonErrorResponses[500]!,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/conversations/{id}/messages/{messageId}/translate",
    tags: ["Chat"],
    summary: "Translate a message into the viewer's native language",
    description:
      "Uses the requested targetLang, otherwise the viewer's SPEAKS NATIVE language (or first SPEAKS language). Voice/video need a transcript first. Results are stored per target language and do not overwrite other languages. Compatibility fields translatedContent/translatedLang are filled from the requested translation only.",
    security: bearerAuth,
    request: {
      params: ConversationMessageParamSchema,
      body: {
        required: false,
        content: {
          "application/json": {
            schema: TranslateMessageRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Message with translatedContent",
        content: { "application/json": { schema: ChatMessageSchema } },
      },
      400: commonErrorResponses[400]!,
      401: commonErrorResponses[401]!,
      403: forbidden,
      404: commonErrorResponses[404]!,
      500: commonErrorResponses[500]!,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/conversations/{id}/messages/{messageId}/transcribe",
    tags: ["Chat"],
    summary: "Transcribe a voice or video message",
    description: "Requires OPENAI_API_KEY on the server. Returns 501 if transcription is not configured.",
    security: bearerAuth,
    request: {
      params: ConversationMessageParamSchema,
    },
    responses: {
      200: {
        description: "Message with transcript",
        content: { "application/json": { schema: ChatMessageSchema } },
      },
      400: commonErrorResponses[400]!,
      401: commonErrorResponses[401]!,
      403: forbidden,
      404: commonErrorResponses[404]!,
      500: commonErrorResponses[500]!,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/media/uploads",
    tags: ["Chat"],
    summary: "Upload a chat photo, voice note, or video",
    description: "Multipart form field `file`. Max 40 MB. Returns a public URL to send as message content.",
    security: bearerAuth,
    request: {
      body: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: MediaUploadRequestSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Uploaded file",
        content: { "application/json": { schema: MediaUploadResultSchema } },
      },
      400: commonErrorResponses[400]!,
      401: commonErrorResponses[401]!,
      500: commonErrorResponses[500]!,
    },
  });
}
