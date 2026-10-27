import { QueryClient } from "@tanstack/react-query";

import { isApiError } from "./api/errors";
import { PERSIST_MAX_AGE_MS } from "./queryPersistence";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // As long as the on-disk copy lives, or persisted queries would be dropped before saving.
      gcTime: PERSIST_MAX_AGE_MS,
      retry: (count, error) => {
        if (isApiError(error) && (error.isUnauthorized || error.status === 403)) {
          return false;
        }
        return count < 1;
      },
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
