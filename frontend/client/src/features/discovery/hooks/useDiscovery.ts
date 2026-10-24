import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { queryKeys } from "@/lib/queryKeys";

import { discoverUsers } from "../api/discoveryApi";
import type { DiscoverPage, DiscoveryFilters } from "../types";

export const DISCOVERY_PAGE_SIZE = 20;

function discoveryQueryKey(filters: DiscoveryFilters) {
  return queryKeys.discovery.list(filters);
}

export function getDiscoveryNextPageParam(lastPage: DiscoverPage): number | undefined {
  const page = lastPage.meta?.page ?? lastPage.page;
  const limit = lastPage.meta?.limit ?? lastPage.limit ?? DISCOVERY_PAGE_SIZE;
  const total = lastPage.meta?.total ?? lastPage.totalCount ?? lastPage.total;
  const hasMore = lastPage.meta?.hasMore ?? lastPage.hasMore;
  if (hasMore) {
    return page + 1;
  }
  if (page * limit < total) {
    return page + 1;
  }
  return undefined;
}

export function useDiscovery(filters: DiscoveryFilters) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => discoveryQueryKey(filters), [filters]);

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) =>
      discoverUsers({ ...filters, page: pageParam, limit: DISCOVERY_PAGE_SIZE }, { signal }),
    initialPageParam: 1,
    staleTime: 15_000,
    getNextPageParam: getDiscoveryNextPageParam,
  });

  /** Pull-to-refresh: drop extra pages and reload page 1. */
  const refresh = useCallback(async () => {
    queryClient.setQueryData<{ pages: DiscoverPage[]; pageParams: number[] }>(
      queryKey,
      (current) => {
        if (!current?.pages.length) {
          return current;
        }
        return {
          pages: [current.pages[0]!],
          pageParams: [current.pageParams[0] ?? 1],
        };
      },
    );
    await queryClient.refetchQueries({ queryKey });
  }, [queryClient, queryKey]);

  return { ...query, refresh };
}
