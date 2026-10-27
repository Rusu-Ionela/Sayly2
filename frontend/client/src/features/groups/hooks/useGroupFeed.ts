import {
  GROUP_FEED_EVENTS,
  emptyReactionCounts,
  type GroupCommentDeletedEvent,
  type GroupCommentNewEvent,
  type GroupPostDeletedEvent,
  type GroupPostKind,
  type GroupPostNewEvent,
  type GroupPostReaction,
  type GroupPostUpdatedEvent,
} from "@sayly/shared";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";

import { useAuth } from "@/features/auth";
import { createClientMessageId } from "@/features/chat/model/clientMessageId";
import { useSocketContext } from "@/features/chat/socket/SocketProvider";
import { queryKeys } from "@/lib/queryKeys";

import * as api from "../api/groupFeedApi";
import {
  applyPostCounts,
  flattenComments,
  flattenPosts,
  mapPosts,
  removeComment,
  removePost,
  toggleReaction,
  upsertComment,
  upsertPost,
  type CommentPages,
  type FeedComment,
  type FeedPages,
  type FeedPost,
} from "../model/feedModel";

/** Applies one change to a post wherever it is cached: the feed and its detail screen. */
function updatePost(
  queryClient: QueryClient,
  groupId: string,
  postId: string,
  fn: (post: FeedPost) => FeedPost,
) {
  queryClient.setQueryData<FeedPages>(queryKeys.groups.feed(groupId), (data) =>
    mapPosts(data, (post) => (post.id === postId ? fn(post) : post)),
  );
  queryClient.setQueryData<FeedPost>(queryKeys.groups.post(groupId, postId), (post) =>
    post ? fn(post) : post,
  );
}

/**
 * Keeps the feed, open posts and their threads in sync with `group_post_*` socket events.
 * Every update is idempotent, so mounting it on several screens at once is safe.
 */
function useGroupFeedLive(groupId: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const { socket } = useSocketContext();

  useEffect(() => {
    if (!socket || !enabled) return;

    const onPostNew = (post: GroupPostNewEvent) => {
      if (post.groupId !== groupId) return;
      queryClient.setQueryData<FeedPages>(queryKeys.groups.feed(groupId), (data) =>
        upsertPost(data, post, true),
      );
    };
    const onPostUpdated = (event: GroupPostUpdatedEvent) => {
      if (event.groupId !== groupId) return;
      updatePost(queryClient, groupId, event.id, (post) => applyPostCounts(post, event));
    };
    const onPostDeleted = (event: GroupPostDeletedEvent) => {
      if (event.groupId !== groupId) return;
      queryClient.setQueryData<FeedPages>(queryKeys.groups.feed(groupId), (data) =>
        removePost(data, event.id),
      );
      queryClient.removeQueries({ queryKey: queryKeys.groups.post(groupId, event.id) });
      queryClient.removeQueries({ queryKey: queryKeys.groups.comments(groupId, event.id) });
    };
    const onCommentNew = (event: GroupCommentNewEvent) => {
      if (event.groupId !== groupId) return;
      const { commentCount, ...comment } = event;
      updatePost(queryClient, groupId, event.postId, (post) => ({ ...post, commentCount }));
      queryClient.setQueryData<CommentPages>(
        queryKeys.groups.comments(groupId, event.postId),
        (data) => upsertComment(data, comment),
      );
    };
    const onCommentDeleted = (event: GroupCommentDeletedEvent) => {
      if (event.groupId !== groupId) return;
      updatePost(queryClient, groupId, event.postId, (post) => ({
        ...post,
        commentCount: event.commentCount,
      }));
      queryClient.setQueryData<CommentPages>(
        queryKeys.groups.comments(groupId, event.postId),
        (data) => removeComment(data, event.id),
      );
    };

    socket.on(GROUP_FEED_EVENTS.postNew, onPostNew);
    socket.on(GROUP_FEED_EVENTS.postUpdated, onPostUpdated);
    socket.on(GROUP_FEED_EVENTS.postDeleted, onPostDeleted);
    socket.on(GROUP_FEED_EVENTS.commentNew, onCommentNew);
    socket.on(GROUP_FEED_EVENTS.commentDeleted, onCommentDeleted);
    return () => {
      socket.off(GROUP_FEED_EVENTS.postNew, onPostNew);
      socket.off(GROUP_FEED_EVENTS.postUpdated, onPostUpdated);
      socket.off(GROUP_FEED_EVENTS.postDeleted, onPostDeleted);
      socket.off(GROUP_FEED_EVENTS.commentNew, onCommentNew);
      socket.off(GROUP_FEED_EVENTS.commentDeleted, onCommentDeleted);
    };
  }, [socket, enabled, groupId, queryClient]);
}

/** Optimistic reaction toggle shared by feed cards and the post screen; rolls back on error. */
export function usePostReaction(groupId: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (vars: { postId: string; kind: GroupPostReaction | null }) =>
      api.setReaction(groupId, vars.postId, vars.kind),
    onSuccess: (post) => {
      updatePost(queryClient, groupId, post.id, (current) => ({
        ...current,
        reactions: post.reactions,
      }));
    },
  });

  return useCallback(
    (post: FeedPost, kind: GroupPostReaction) => {
      if (post.localState) return; // not on the server yet
      const before = post.reactions;
      const { next, sent } = toggleReaction(before, kind);
      updatePost(queryClient, groupId, post.id, (current) => ({ ...current, reactions: next }));
      mutation.mutate(
        { postId: post.id, kind: sent },
        {
          onError: () =>
            updatePost(queryClient, groupId, post.id, (current) => ({
              ...current,
              reactions: before,
            })),
        },
      );
    },
    [groupId, mutation, queryClient],
  );
}

export function useDeletePost(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => api.deletePost(groupId, postId),
    onSuccess: (_void, postId) => {
      queryClient.setQueryData<FeedPages>(queryKeys.groups.feed(groupId), (data) =>
        removePost(data, postId),
      );
      queryClient.removeQueries({ queryKey: queryKeys.groups.post(groupId, postId) });
    },
  });
}

/** The group's feed: newest first, older pages on scroll, optimistic posting. */
export function useGroupFeed(groupId: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const key = queryKeys.groups.feed(groupId);
  useGroupFeedLive(groupId, enabled);

  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam, signal }) => api.listPosts(groupId, pageParam, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore && last.nextCursor ? last.nextCursor : undefined),
    enabled,
    staleTime: 15_000,
  });

  const createMutation = useMutation({
    mutationFn: (vars: { body: string; kind: GroupPostKind; clientId: string }) =>
      api.createPost(groupId, vars),
    onMutate: ({ body, kind, clientId }) => {
      const optimistic: FeedPost = {
        id: clientId,
        clientId,
        groupId,
        kind,
        body,
        author: { id: userId ?? "", displayName: "You", avatarUrl: null },
        commentCount: 0,
        reactions: { counts: emptyReactionCounts(), total: 0, mine: null },
        createdAt: new Date().toISOString(),
        localState: "sending",
      };
      queryClient.setQueryData<FeedPages>(key, (data) => upsertPost(data, optimistic));
      return { optimistic };
    },
    onSuccess: (post) => {
      queryClient.setQueryData<FeedPages>(key, (data) => upsertPost(data, post));
    },
    onError: (_error, _vars, context) => {
      if (!context) return;
      queryClient.setQueryData<FeedPages>(key, (data) =>
        upsertPost(data, { ...context.optimistic, localState: "failed" }),
      );
    },
  });

  const publish = useCallback(
    (body: string, kind: GroupPostKind) =>
      createMutation.mutate({ body, kind, clientId: createClientMessageId() }),
    [createMutation],
  );
  // The same client id lets the server recognise a post that did land.
  const retry = useCallback(
    (post: FeedPost) =>
      createMutation.mutate({
        body: post.body,
        kind: post.kind,
        clientId: post.clientId ?? post.id,
      }),
    [createMutation],
  );

  const posts = useMemo(() => flattenPosts(query.data), [query.data]);
  return { ...query, posts, publish, retry };
}

/** One post; seeded from the feed so the screen opens instantly. */
export function useGroupPost(groupId: string, postId: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.groups.post(groupId, postId),
    queryFn: ({ signal }) => api.getPost(groupId, postId, { signal }),
    initialData: () =>
      flattenPosts(queryClient.getQueryData<FeedPages>(queryKeys.groups.feed(groupId))).find(
        (post) => post.id === postId && !post.localState,
      ),
    staleTime: 10_000,
  });
}

/** A post's thread: oldest first, live, with optimistic comments. */
export function usePostComments(groupId: string, postId: string) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const key = queryKeys.groups.comments(groupId, postId);
  useGroupFeedLive(groupId, true);

  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam, signal }) => api.listComments(groupId, postId, pageParam, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore && last.nextCursor ? last.nextCursor : undefined),
  });

  const createMutation = useMutation({
    mutationFn: (vars: { body: string; clientId: string }) =>
      api.createComment(groupId, postId, vars),
    onMutate: ({ body, clientId }) => {
      const optimistic: FeedComment = {
        id: clientId,
        clientId,
        postId,
        groupId,
        body,
        author: { id: userId ?? "", displayName: "You", avatarUrl: null },
        createdAt: new Date().toISOString(),
        localState: "sending",
      };
      queryClient.setQueryData<CommentPages>(key, (data) => upsertComment(data, optimistic));
      return { optimistic };
    },
    onSuccess: (comment) => {
      queryClient.setQueryData<CommentPages>(key, (data) => upsertComment(data, comment));
    },
    onError: (_error, _vars, context) => {
      if (!context) return;
      queryClient.setQueryData<CommentPages>(key, (data) =>
        upsertComment(data, { ...context.optimistic, localState: "failed" }),
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => api.deleteComment(groupId, postId, commentId),
    onSuccess: (_void, commentId) => {
      queryClient.setQueryData<CommentPages>(key, (data) => removeComment(data, commentId));
    },
  });

  const send = useCallback(
    (body: string) => createMutation.mutate({ body, clientId: createClientMessageId() }),
    [createMutation],
  );
  const retry = useCallback(
    (comment: FeedComment) =>
      createMutation.mutate({ body: comment.body, clientId: comment.clientId ?? comment.id }),
    [createMutation],
  );

  const comments = useMemo(() => flattenComments(query.data), [query.data]);
  return { ...query, comments, send, retry, remove: deleteMutation };
}
