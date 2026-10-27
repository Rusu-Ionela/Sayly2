import { recordActivityInBackground } from "../streaks";

import { withCachedTranslations } from "./learning";
import * as messagingRepository from "./repository";
import type { ListConversationsQuery, ListMessagesQuery, SendMessageInput } from "./types";

export function listConversations(userId: string, query: ListConversationsQuery) {
  return messagingRepository.listConversations(userId, query);
}

/** History with the translations the viewer already asked for, so they survive reopening the chat. */
export async function listMessages(userId: string, conversationId: string, query: ListMessagesQuery) {
  const page = await messagingRepository.listMessages(userId, conversationId, query);
  return { ...page, items: await withCachedTranslations(userId, page.items) };
}

export function getOrCreateDirectConversation(userId: string, otherUserId: string) {
  return messagingRepository.getOrCreateDirectConversation(userId, otherUserId);
}

export function assertCanAccessConversation(conversationId: string, userId: string) {
  return messagingRepository.assertCanAccessConversation(conversationId, userId);
}

/** Every new message also counts the sender's day for their streak. */
export async function sendMessage(userId: string, input: SendMessageInput) {
  const result = await messagingRepository.sendMessage(userId, input);
  if (result.created) {
    recordActivityInBackground(userId);
  }
  return result;
}

export function markMessagesDelivered(messageIds: string[]) {
  return messagingRepository.markMessagesDelivered(messageIds);
}

export function markPendingDelivered(recipientId: string) {
  return messagingRepository.markPendingDelivered(recipientId);
}

export function setConversationAutoTranslate(userId: string, conversationId: string, enabled: boolean) {
  return messagingRepository.setConversationAutoTranslate(userId, conversationId, enabled);
}

export function setConversationPinned(userId: string, conversationId: string, pinned: boolean) {
  return messagingRepository.setConversationPinned(userId, conversationId, pinned);
}

export function markMessagesRead(userId: string, conversationId: string, messageIds?: string[]) {
  return messagingRepository.markMessagesRead(userId, conversationId, messageIds);
}

export function listPartnerIds(userId: string, limit?: number) {
  return messagingRepository.listPartnerIds(userId, limit);
}

export function assertCanSeePresence(viewerId: string, targetId: string) {
  return messagingRepository.assertCanSeePresence(viewerId, targetId);
}

export function persistLastSeen(userId: string, at: Date) {
  return messagingRepository.persistLastSeen(userId, at);
}

export { translateMessage, transcribeMessage, correctMessage, listMessageCorrections, savePhrase, listSavedPhrases, deleteSavedPhrase, listExpressionsFor } from "./learning";
