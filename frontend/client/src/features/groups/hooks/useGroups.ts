import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";

import { useAuth } from "@/features/auth";
import { createClientMessageId } from "@/features/chat/model/clientMessageId";
import { useSocketContext } from "@/features/chat/socket/SocketProvider";
import { queryKeys } from "@/lib/queryKeys";

import * as api from "../api/groupsApi";
import { flattenGroupMessages, upsertGroupMessage } from "../model/groupModel";
import type {
  CreateGroupInput,
  GroupDetail,
  GroupFilters,
  GroupMemberStatus,
  GroupMessage,
} from "../types";

const PAGE_SIZE = 20;

export function useGroupList(filters: GroupFilters) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.groups.list(filters),
    queryFn: ({ pageParam, signal }) =>
      api.listGroups({ ...filters, page: pageParam, limit: PAGE_SIZE }, { signal }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: 20_000,
  });
  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  return { ...query, items, total: query.data?.pages[0]?.total ?? 0 };
}

export function useGroup(groupId: string) {
  return useQuery({
    queryKey: queryKeys.groups.detail(groupId),
    queryFn: ({ signal }) => api.getGroup(groupId, { signal }),
    staleTime: 10_000,
  });
}

export function useGroupMembers(groupId: string, status: GroupMemberStatus, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.groups.members(groupId, status),
    queryFn: ({ signal }) => api.listMembers(groupId, status, { signal }).then((res) => res.items),
    enabled,
  });
}

/**
 * Every membership mutation returns the fresh group; write it to the detail
 * cache and invalidate lists/members so all screens stay in sync.
 */
function useGroupMutation<TVars>(
  groupId: string,
  fn: (vars: TVars) => Promise<GroupDetail | void>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (group) => {
      if (group) queryClient.setQueryData(queryKeys.groups.detail(groupId), group);
      void queryClient.invalidateQueries({ queryKey: ["groups", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["groups", "members", groupId] });
    },
  });
}

export function useGroupActions(groupId: string) {
  return {
    join: useGroupMutation(groupId, () => api.joinGroup(groupId)),
    leave: useGroupMutation(groupId, () => api.leaveGroup(groupId)),
    approve: useGroupMutation(groupId, (userId: string) => api.approveMember(groupId, userId)),
    remove: useGroupMutation(groupId, (userId: string) => api.removeMember(groupId, userId)),
    changeRole: useGroupMutation(
      groupId,
      (vars: { userId: string; role: "MODERATOR" | "MEMBER" }) =>
        api.changeRole(groupId, vars.userId, vars.role),
    ),
    transfer: useGroupMutation(groupId, (userId: string) => api.transferOwnership(groupId, userId)),
    update: useGroupMutation(groupId, (patch: Partial<CreateGroupInput>) =>
      api.updateGroup(groupId, patch),
    ),
  };
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteGroup,
    onSuccess: (_void, groupId) => {
      queryClient.removeQueries({ queryKey: queryKeys.groups.detail(groupId) });
      void queryClient.invalidateQueries({ queryKey: ["groups", "list"] });
    },
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createGroup,
    onSuccess: (group) => {
      queryClient.setQueryData(queryKeys.groups.detail(group.id), group);
      void queryClient.invalidateQueries({ queryKey: ["groups", "list"] });
    },
  });
}

/** Group discussion: cursor history, optimistic sends with rollback, live socket updates. */
export function useGroupChat(groupId: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const { socket } = useSocketContext();
  const key = queryKeys.groups.messages(groupId);

  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam, signal }) => api.listGroupMessages(groupId, pageParam, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore && last.nextCursor ? last.nextCursor : undefined),
    enabled,
  });

  const markRead = useCallback(() => {
    void api
      .markGroupRead(groupId)
      .then(() => queryClient.invalidateQueries({ queryKey: ["groups", "list"] }))
      .catch(() => undefined);
  }, [groupId, queryClient]);

  useEffect(() => {
    if (enabled) markRead();
  }, [enabled, markRead]);

  useEffect(() => {
    if (!socket || !enabled) return;
    const onMessage = (message: GroupMessage) => {
      if (message.groupId !== groupId) return;
      queryClient.setQueryData(
        queryKeys.groups.messages(groupId),
        (data: Parameters<typeof upsertGroupMessage>[0]) => upsertGroupMessage(data, message),
      );
      if (message.senderId !== userId) markRead();
    };
    socket.on("group_message_new", onMessage);
    return () => {
      socket.off("group_message_new", onMessage);
    };
  }, [socket, enabled, groupId, queryClient, userId, markRead]);

  const sendMutation = useMutation({
    mutationFn: (vars: { content: string; clientMessageId: string }) =>
      api.sendGroupMessage(groupId, vars.content, vars.clientMessageId),
    onMutate: ({ content, clientMessageId }) => {
      const now = new Date().toISOString();
      const optimistic: GroupMessage = {
        id: clientMessageId,
        clientMessageId,
        groupId,
        conversationId: "",
        senderId: userId ?? "",
        type: "TEXT",
        content,
        status: "SENT",
        createdAt: now,
        updatedAt: now,
        sender: { id: userId ?? "", displayName: "You", avatarUrl: null, country: "" },
        localState: "sending",
      };
      queryClient.setQueryData(key, (data: Parameters<typeof upsertGroupMessage>[0]) =>
        upsertGroupMessage(data, optimistic),
      );
      return { optimistic };
    },
    onSuccess: (message) => {
      queryClient.setQueryData(key, (data: Parameters<typeof upsertGroupMessage>[0]) =>
        upsertGroupMessage(data, message),
      );
    },
    onError: (_error, _vars, context) => {
      if (!context) return;
      queryClient.setQueryData(key, (data: Parameters<typeof upsertGroupMessage>[0]) =>
        upsertGroupMessage(data, { ...context.optimistic, localState: "failed" }),
      );
    },
  });

  const send = useCallback(
    (content: string) => sendMutation.mutate({ content, clientMessageId: createClientMessageId() }),
    [sendMutation],
  );
  // Retrying reuses the same clientMessageId, so the server dedupes a send that actually landed.
  const retry = useCallback(
    (message: GroupMessage) =>
      sendMutation.mutate({
        content: message.content,
        clientMessageId: message.clientMessageId ?? message.id,
      }),
    [sendMutation],
  );

  return {
    ...query,
    messages: flattenGroupMessages(query.data),
    send,
    retry,
    isSending: sendMutation.isPending,
  };
}
