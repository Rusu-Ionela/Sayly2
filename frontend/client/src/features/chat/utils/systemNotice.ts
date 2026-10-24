import type { ChatMessage } from "../types";

/** The sentence a SYSTEM message stands for, from the viewer's side of the pair. */
export function systemNoticeText(
  message: Pick<ChatMessage, "senderId">,
  viewerId: string | null | undefined,
  partnerName: string | null | undefined,
) {
  const name = partnerName?.trim() || "Your partner";
  return message.senderId === viewerId ? `You followed ${name}` : `${name} started following you`;
}
