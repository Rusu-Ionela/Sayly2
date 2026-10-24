import { useEffect } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

import { listProfileVisits, markVisitorsSeen, type VisitsMode } from "../api/visitorsApi";

export function useProfileVisits(mode: VisitsMode) {
  const queryClient = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: queryKeys.profileVisits.list(mode),
    queryFn: ({ pageParam }) => listProfileVisits(mode, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    staleTime: 15_000,
  });

  const first = query.data?.pages[0];
  const shouldMarkSeen =
    mode === "visitors" && first !== undefined && !first.locked && first.newCount > 0;

  // Once a Pro member has seen the list, the dashboard's "new visitors" count resets.
  // Items keep their "new" highlight until the next reload.
  useEffect(() => {
    if (!shouldMarkSeen) return;
    void markVisitorsSeen()
      .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.profile.me }))
      .catch(() => undefined);
  }, [shouldMarkSeen, queryClient]);

  return query;
}
