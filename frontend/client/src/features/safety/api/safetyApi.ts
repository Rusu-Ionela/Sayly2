import { apiClient } from "@/lib/apiClient";

import type { BlockResult, ReportReason, ReportResult } from "../types";

export function blockUser(userId: string) {
  return apiClient.post<BlockResult>("/blocks", { userId });
}

export type BlockedUserItem = {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: string;
  user: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    country: string;
  };
};

export function listBlockedUsers() {
  return apiClient.get<{ items: BlockedUserItem[] }>("/blocks");
}

export function unblockUser(userId: string) {
  return apiClient.delete<void>(`/blocks/${userId}`);
}

export function reportUser(input: {
  userId: string;
  reason: ReportReason;
  messageId?: string;
  details?: string;
}) {
  return apiClient.post<ReportResult>("/reports", input);
}

export function deleteAccount() {
  return apiClient.delete<{ ok: true }>("/users/me");
}

export function changePassword(currentPassword: string, newPassword: string) {
  return apiClient.patch<{ ok: true }>("/users/me/password", {
    currentPassword,
    newPassword,
  });
}
