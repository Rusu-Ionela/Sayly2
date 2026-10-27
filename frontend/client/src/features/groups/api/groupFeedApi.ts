import type {
  CreateGroupCommentInput,
  CreateGroupPostInput,
  GroupCommentDto,
  GroupCommentsPage,
  GroupPostDto,
  GroupPostReaction,
  GroupPostsPage,
} from "@sayly/shared";

import { apiClient } from "@/lib/apiClient";

type RequestOpts = { signal?: AbortSignal };

const base = (groupId: string) => `/groups/${groupId}/posts`;

function pageQuery(before: string | undefined) {
  const params = new URLSearchParams();
  if (before) params.set("before", before);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const listPosts = (groupId: string, before: string | undefined, opts: RequestOpts = {}) =>
  apiClient.get<GroupPostsPage>(`${base(groupId)}${pageQuery(before)}`, { signal: opts.signal });

export const getPost = (groupId: string, postId: string, opts: RequestOpts = {}) =>
  apiClient.get<GroupPostDto>(`${base(groupId)}/${postId}`, { signal: opts.signal });

export const createPost = (groupId: string, input: CreateGroupPostInput) =>
  apiClient.post<GroupPostDto>(base(groupId), input);

export const deletePost = (groupId: string, postId: string) =>
  apiClient.delete<void>(`${base(groupId)}/${postId}`);

export const setReaction = (groupId: string, postId: string, kind: GroupPostReaction | null) =>
  kind
    ? apiClient.put<GroupPostDto>(`${base(groupId)}/${postId}/reaction`, { kind })
    : apiClient.delete<GroupPostDto>(`${base(groupId)}/${postId}/reaction`);

export const listComments = (
  groupId: string,
  postId: string,
  before: string | undefined,
  opts: RequestOpts = {},
) =>
  apiClient.get<GroupCommentsPage>(`${base(groupId)}/${postId}/comments${pageQuery(before)}`, {
    signal: opts.signal,
  });

export const createComment = (groupId: string, postId: string, input: CreateGroupCommentInput) =>
  apiClient.post<GroupCommentDto>(`${base(groupId)}/${postId}/comments`, input);

export const deleteComment = (groupId: string, postId: string, commentId: string) =>
  apiClient.delete<void>(`${base(groupId)}/${postId}/comments/${commentId}`);
