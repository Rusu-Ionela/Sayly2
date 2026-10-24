import { apiClient } from "@/lib/apiClient";
import type { MemberSummary } from "@/shared/types/member";

/** A member card plus when you followed them. */
export type FollowingPerson = MemberSummary & { followedAt: string };

export type FollowingPage = { items: FollowingPerson[]; page: number; hasMore: boolean };

export function followUser(userId: string) {
  return apiClient.put<{ following: boolean }>(`/follows/${encodeURIComponent(userId)}`);
}

export function unfollowUser(userId: string) {
  return apiClient.delete<{ following: boolean }>(`/follows/${encodeURIComponent(userId)}`);
}

export function getFollowing(page: number) {
  return apiClient.get<FollowingPage>(`/follows?page=${page}`);
}
