import { apiClient } from "@/lib/apiClient";

export function registerPushToken(token: string, platform: "ios" | "android") {
  return apiClient.post<void>("/notifications/push-tokens", { token, platform });
}

export function unregisterPushToken(token: string) {
  return apiClient.delete<void>(`/notifications/push-tokens/${encodeURIComponent(token)}`);
}

export type InboxType = "CORRECTION" | "REFERENCE";

export type InboxItem = {
  id: string;
  type: InboxType;
  conversationId: string | null;
  createdAt: string;
  readAt: string | null;
  actor: { id: string; displayName: string; avatarUrl: string | null };
};

export type InboxPage = { items: InboxItem[]; page: number; hasMore: boolean };

export function getInbox(page: number) {
  return apiClient.get<InboxPage>(`/notifications?page=${page}`);
}

export function getUnreadCount() {
  return apiClient.get<{ count: number }>("/notifications/unread-count");
}

export function markInboxItemRead(id: string) {
  return apiClient.patch<void>(`/notifications/${encodeURIComponent(id)}/read`);
}

export function markInboxRead() {
  return apiClient.patch<void>("/notifications/read-all");
}
