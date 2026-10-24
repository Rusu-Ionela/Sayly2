import { QueryClient } from "@tanstack/react-query";

import { isApiError } from "./api/errors";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
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
