import type { ChatMessage } from "../types";

/**
 * Whether a message has text the API can translate: written text, a photo caption, or the
 * transcript of a voice/video note. Same rule as the server's `textToTranslate`.
 */
export function canTranslate(
  message: Pick<ChatMessage, "type" | "caption" | "transcript">,
): boolean {
  if (message.type === "SYSTEM") return false;
  if (message.type === "TEXT") return true;
  if (message.type === "IMAGE") return Boolean(message.caption?.trim());
  return Boolean(message.transcript?.trim());
}

/** At most this many incoming messages are translated automatically per chat visit. */
export const AUTO_TRANSLATE_LIMIT = 20;

/**
 * Incoming messages auto-translate should handle next, newest first: from the partner,
 * translatable, not translated yet, not tried before in this visit.
 */
export function autoTranslateQueue(
  messagesNewestFirst: ChatMessage[],
  myUserId: string | null | undefined,
  tried: ReadonlySet<string>,
  isLocal: (id: string) => boolean,
): ChatMessage[] {
  const room = AUTO_TRANSLATE_LIMIT - tried.size;
  if (room <= 0) return [];
  return messagesNewestFirst
    .filter(
      (message) =>
        message.senderId !== myUserId &&
        !message.translatedContent &&
        !tried.has(message.id) &&
        !isLocal(message.id) &&
        canTranslate(message),
    )
    .slice(0, room);
}
