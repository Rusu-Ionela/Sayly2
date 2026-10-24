import * as messagingRepository from "./repository";
import type { ListConversationsQuery, ListMessagesQuery, SendMessageInput } from "./types";

export function listConversations(userId: string, query: ListConversationsQuery) {
  return messagingRepository.listConversations(userId, query);
}

export function listMessages(userId: string, conversationId: string, query: ListMessagesQuery) {
  return messagingRepository.listMessages(userId, conversationId, query);
}

export function getOrCreateDirectConversation(userId: string, otherUserId: string) {
  return messagingRepository.getOrCreateDirectConversation(userId, otherUserId);
}

export function assertCanAccessConversation(conversationId: string, userId: string) {
  return messagingRepository.assertCanAccessConversation(conversationId, userId);
}

export function sendMessage(userId: string, input: SendMessageInput) {
  return messagingRepository.sendMessage(userId, input);
}

export function markMessagesDelivered(messageIds: string[]) {
  return messagingRepository.markMessagesDelivered(messageIds);
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
