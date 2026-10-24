import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

import {
  createTopic,
  deleteTopic,
  listTopics,
  setMainTopic,
  type ConversationTopics,
} from "../api/topicsApi";

export function useTopics() {
  return useQuery({ queryKey: queryKeys.topics.mine, queryFn: listTopics });
}

/**
 * Topic writes. Deletes and "make main" are optimistic; every response replaces the
 * cached list, and the profile (which shows the main topic) is refreshed.
 */
export function useTopicMutations() {
  const queryClient = useQueryClient();
  const key = queryKeys.topics.mine;

  const settle = {
    onSuccess: (topics: ConversationTopics) => queryClient.setQueryData(key, topics),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.profile.me }),
  };

  const optimistic = (project: (topics: ConversationTopics, id: string) => ConversationTopics) => ({
    onMutate: async (topicId: string) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ConversationTopics>(key);
      if (previous) queryClient.setQueryData(key, project(previous, topicId));
      return { previous };
    },
    onError: (_error: unknown, _id: string, context?: { previous?: ConversationTopics }) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
  });

  const create = useMutation({ mutationFn: createTopic, ...settle });

  const remove = useMutation({
    mutationFn: deleteTopic,
    ...settle,
    ...optimistic((topics, id) => ({
      ...topics,
      items: topics.items.filter((item) => item.id !== id),
    })),
  });

  const makeMain = useMutation({
    mutationFn: setMainTopic,
    ...settle,
    ...optimistic((topics, id) => ({
      ...topics,
      items: topics.items
        .map((item) => ({ ...item, isMain: item.id === id }))
        .sort((a, b) => Number(b.isMain) - Number(a.isMain)),
    })),
  });

  return { create, remove, makeMain };
}
