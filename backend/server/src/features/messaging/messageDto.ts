
import { resignMediaUrl } from "../media/storage";

import type {
  ChatMessage,
  MessageRow,
} from "./types";

export function toMessageDto(message: MessageRow): ChatMessage {
  return toTranslatedMessageDto(message, null);
}

export function toTranslatedMessageDto(
  message: MessageRow,
  translation: { text: string; lang: string } | null,
): ChatMessage {
  const mediaTypes = new Set(["IMAGE", "VOICE", "VIDEO"]);
  const content =
    mediaTypes.has(message.type) ? resignMediaUrl(message.content) ?? message.content : message.content;
  const thumbnailUrl = resignMediaUrl(message.thumbnailUrl);

  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    type: message.type,
    content,
    status: message.status,
    durationMs: message.durationMs,
    mimeType: message.mimeType,
    thumbnailUrl,
    transcript: message.transcript,
    translatedContent: translation?.text ?? null,
    translatedLang: translation?.lang ?? null,
    caption: message.caption,
    clientMessageId: message.clientMessageId,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  };
}

