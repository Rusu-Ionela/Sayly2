import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

import {
  deleteReference,
  getReferences,
  saveReference,
  type SaveReferenceInput,
} from "../api/referencesApi";

export function useReferences(userId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.references.user(userId),
    queryFn: ({ pageParam }) => getReferences(userId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: 30_000,
  });
}

/** Save or delete the viewer's reference, then refresh the list and the profile's summary. */
export function useReferenceMutations(userId: string) {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.references.user(userId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.profile.public(userId) });
  };

  return {
    save: useMutation({
      mutationFn: (input: SaveReferenceInput) => saveReference(userId, input),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: () => deleteReference(userId), onSuccess: refresh }),
  };
}
