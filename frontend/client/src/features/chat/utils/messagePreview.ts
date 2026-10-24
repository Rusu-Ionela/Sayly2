import type { ChatMessage } from "../types";

import { systemNoticeText } from "./systemNotice";

/** `viewer` is needed to word system notices ("You followed…" vs "…followed you"). */
export function lastMessagePreview(
  message: ChatMessage | null | undefined,
  viewer?: { id?: string | null; partnerName?: string | null },
) {
  if (!message) {
    return "No messages yet";
  }
  if (message.type === "IMAGE") return message.caption?.trim() || "Photo";
  if (message.type === "VOICE") return "Voice message";
  if (message.type === "VIDEO") return message.caption?.trim() || "Video";
  if (message.type === "SYSTEM") return systemNoticeText(message, viewer?.id, viewer?.partnerName);
  return message.content;
}

export function formatDuration(durationMs?: number | null) {
  if (!durationMs || durationMs < 0) return "0:00";
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
