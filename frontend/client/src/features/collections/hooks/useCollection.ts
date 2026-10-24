import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

import {
  deleteSavedPhrase,
  listExpressions,
  listSavedPhrases,
  savePhrase,
  type ExpressionsResponse,
  type SavedPhrase,
} from "../api/collectionsApi";

type PhraseList = { items: SavedPhrase[] };

export function useSavedPhrases() {
  return useQuery({
    queryKey: queryKeys.collection.phrases,
    queryFn: listSavedPhrases,
    staleTime: 30_000,
  });
}

export function useExpressions(language?: string) {
  return useQuery({
    queryKey: [...queryKeys.collection.expressions, language ?? "learning"],
    queryFn: () => listExpressions(language),
    staleTime: 5 * 60_000,
  });
}

/** Saved-count on the profile and the expressions' "saved" marks depend on the list. */
function useRefreshCollection() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.collection.phrases });
    void queryClient.invalidateQueries({ queryKey: queryKeys.collection.expressions });
    void queryClient.invalidateQueries({ queryKey: queryKeys.profile.me });
  };
}

/** Optimistically marks/unmarks an expression as saved across cached expression lists. */
function markExpression(
  queryClient: ReturnType<typeof useQueryClient>,
  expressionId: string,
  savedPhraseId: string | null,
) {
  queryClient.setQueriesData<ExpressionsResponse>(
    { queryKey: queryKeys.collection.expressions },
    (data) =>
      data && {
        ...data,
        items: data.items.map((item) =>
          item.id === expressionId ? { ...item, savedPhraseId } : item,
        ),
      },
  );
}

export function useSaveExpression() {
  const queryClient = useQueryClient();
  const refresh = useRefreshCollection();

  return useMutation({
    mutationFn: (expressionId: string) => savePhrase({ expressionId }),
    onMutate: (expressionId) => markExpression(queryClient, expressionId, "pending"),
    onError: (_error, expressionId) => markExpression(queryClient, expressionId, null),
    onSettled: refresh,
  });
}

/** Removes an entry; it disappears at once and comes back if the server refuses. */
export function useRemovePhrase() {
  const queryClient = useQueryClient();
  const refresh = useRefreshCollection();

  return useMutation({
    mutationFn: (phrase: SavedPhrase) => deleteSavedPhrase(phrase.id),
    onMutate: async (phrase) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.collection.phrases });
      const previous = queryClient.getQueryData<PhraseList>(queryKeys.collection.phrases);
      if (previous) {
        queryClient.setQueryData<PhraseList>(queryKeys.collection.phrases, {
          items: previous.items.filter((item) => item.id !== phrase.id),
        });
      }
      if (phrase.expressionId) markExpression(queryClient, phrase.expressionId, null);
      return { previous };
    },
    onError: (_error, _phrase, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.collection.phrases, context.previous);
      }
    },
    onSettled: refresh,
  });
}
