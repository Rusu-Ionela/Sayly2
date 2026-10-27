import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORY_TTL_HOURS } from "@sayly/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { queryKeys } from "@/lib/queryKeys";

import { deleteStory, getStoryFeed, postStory, replyToStory, type StoryDraft } from "./api";

export function useStoryFeed() {
  return useQuery({
    queryKey: queryKeys.stories.feed,
    queryFn: getStoryFeed,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export function useCreateStory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: StoryDraft) => postStory(draft),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.stories.feed });
      void queryClient.invalidateQueries({ queryKey: queryKeys.streak.me });
    },
  });
}

export function useDeleteStory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteStory,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.stories.feed }),
  });
}

export function useStoryReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ storyId, text }: { storyId: string; text: string }) =>
      replyToStory(storyId, text),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations }),
  });
}

const SEEN_KEY = "stories.seen.v1";
const SEEN_TTL_MS = STORY_TTL_HOURS * 60 * 60 * 1000;
const SEEN_MAX = 500;

type SeenRecord = Record<string, number>;

/** Drops entries older than a story can live, and keeps the newest few hundred. */
function pruneSeen(record: SeenRecord, now: number): SeenRecord {
  const fresh = Object.entries(record)
    .filter(([, at]) => now - at < SEEN_TTL_MS)
    .sort((a, b) => b[1] - a[1])
    .slice(0, SEEN_MAX);
  return Object.fromEntries(fresh);
}

/**
 * Which stories this phone has already shown, so watched rings fade. Kept on the device only;
 * if storage is unavailable it still works for the session.
 */
export function useSeenStories() {
  const [record, setRecord] = useState<SeenRecord>({});

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(SEEN_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === "object") {
          setRecord((current) => ({
            ...pruneSeen(parsed as SeenRecord, Date.now()),
            ...current,
          }));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const markSeen = useCallback((storyId: string) => {
    setRecord((current) => {
      if (current[storyId]) return current;
      const next = pruneSeen({ ...current, [storyId]: Date.now() }, Date.now());
      void AsyncStorage.setItem(SEEN_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const seen = useMemo<ReadonlySet<string>>(() => new Set(Object.keys(record)), [record]);

  return { seen, markSeen };
}
