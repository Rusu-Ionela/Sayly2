import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { useAuth } from "@/features/auth";
import { queryKeys } from "@/lib/queryKeys";

import { getConversationsPage } from "../api/chatApi";
import { patchConversationWithMessage, patchPartnerPresence } from "../cache";
import { useSocketContext } from "../socket/SocketProvider";
import type { ChatMessage, Conversation, UserOnlineStatusEvent } from "../types";

export function useConversations() {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const { socket, isConnected, status } = useSocketContext();

  const query = useInfiniteQuery({
    queryKey: queryKeys.chat.conversations,
    queryFn: ({ pageParam, signal }) =>
      getConversationsPage({ cursor: pageParam, limit: 50 }, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,
    staleTime: 15_000,
  });

  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const onNew = (message: ChatMessage) => {
      patchConversationWithMessage(queryClient, message, userId);
    };

    const onPresence = (payload: UserOnlineStatusEvent) => {
      patchPartnerPresence(queryClient, payload);
    };

    const onStatus = (payload: { conversationId: string; messages: ChatMessage[] }) => {
      for (const message of payload.messages) {
        patchConversationWithMessage(queryClient, message, userId, { statusOnly: true });
      }
    };

    socket.on("message_new", onNew);
    socket.on("message_status", onStatus);
    socket.on("user_online_status", onPresence);

    return () => {
      socket.off("message_new", onNew);
      socket.off("message_status", onStatus);
      socket.off("user_online_status", onPresence);
    };
  }, [socket, isConnected, queryClient, userId]);

  return {
    ...query,
    data: items as Conversation[],
    socketStatus: status,
  };
}
