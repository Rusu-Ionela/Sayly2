import { apiClient } from "@/lib/apiClient";

import type {
  CreateGroupInput,
  GroupDetail,
  GroupFilters,
  GroupMember,
  GroupMemberStatus,
  GroupMessage,
  GroupMessagesPage,
  GroupsPage,
} from "../types";

type RequestOpts = { signal?: AbortSignal };

export function listGroups(
  filters: GroupFilters & { page: number; limit?: number },
  opts: RequestOpts = {},
) {
  const params = new URLSearchParams({
    scope: filters.scope,
    page: String(filters.page),
    limit: String(filters.limit ?? 20),
  });
  for (const key of ["search", "languageId", "level", "topic", "sort"] as const) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  return apiClient.get<GroupsPage>(`/groups?${params.toString()}`, { signal: opts.signal });
}

export const getGroup = (groupId: string, opts: RequestOpts = {}) =>
  apiClient.get<GroupDetail>(`/groups/${groupId}`, { signal: opts.signal });

export const createGroup = (input: CreateGroupInput) =>
  apiClient.post<GroupDetail>("/groups", input);
export const updateGroup = (groupId: string, patch: Partial<CreateGroupInput>) =>
  apiClient.patch<GroupDetail>(`/groups/${groupId}`, patch);
export const deleteGroup = (groupId: string) => apiClient.delete<void>(`/groups/${groupId}`);
export const joinGroup = (groupId: string) =>
  apiClient.post<GroupDetail>(`/groups/${groupId}/join`);
export const leaveGroup = (groupId: string) =>
  apiClient.post<GroupDetail>(`/groups/${groupId}/leave`);
export const transferOwnership = (groupId: string, userId: string) =>
  apiClient.post<GroupDetail>(`/groups/${groupId}/transfer`, { userId });

export const listMembers = (groupId: string, status: GroupMemberStatus, opts: RequestOpts = {}) =>
  apiClient.get<{ items: GroupMember[] }>(`/groups/${groupId}/members?status=${status}`, {
    signal: opts.signal,
  });
export const approveMember = (groupId: string, userId: string) =>
  apiClient.post<GroupDetail>(`/groups/${groupId}/members/${userId}/approve`);
export const removeMember = (groupId: string, userId: string) =>
  apiClient.delete<GroupDetail>(`/groups/${groupId}/members/${userId}`);
export const changeRole = (groupId: string, userId: string, role: "MODERATOR" | "MEMBER") =>
  apiClient.patch<GroupDetail>(`/groups/${groupId}/members/${userId}`, { role });

export function listGroupMessages(
  groupId: string,
  before: string | undefined,
  opts: RequestOpts = {},
) {
  const params = new URLSearchParams({ limit: "30" });
  if (before) params.set("before", before);
  return apiClient.get<GroupMessagesPage>(`/groups/${groupId}/messages?${params.toString()}`, {
    signal: opts.signal,
  });
}

export const sendGroupMessage = (groupId: string, content: string, clientMessageId: string) =>
  apiClient.post<GroupMessage>(`/groups/${groupId}/messages`, { content, clientMessageId });
export const markGroupRead = (groupId: string) => apiClient.patch<void>(`/groups/${groupId}/read`);
