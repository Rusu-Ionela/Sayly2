import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

import { getInbox, getUnreadCount, markInboxItemRead, markInboxRead } from "./api";

export function useInbox() {
  return useInfiniteQuery({
    queryKey: queryKeys.notifications.inbox,
    queryFn: ({ pageParam }) => getInbox(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: 15_000,
  });
}

/** Bell badge count; polled gently because inbox items are not pushed over the socket. */
export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unread,
    queryFn: getUnreadCount,
    select: (data) => data.count,
    refetchInterval: 60_000,
    staleTime: 15_000,
  });
}

/** Mark one item or, with no id, all of them; refresh the list and the badge afterwards. */
export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id?: string) => (id ? markInboxItemRead(id) : markInboxRead()),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.inbox });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unread });
    },
  });
}
