import type { IcebreakerTodayDto } from "@sayly/shared";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useProfile } from "@/features/profile";
import { queryKeys } from "@/lib/queryKeys";
import { preferencesStorage } from "@/lib/storage";

import {
  deleteIcebreakerAnswer,
  getIcebreakerAnswers,
  getTodayIcebreaker,
  saveIcebreakerAnswer,
} from "./api";

export type PracticeLanguage = { id: string; name: string; flagEmoji?: string };

/** Languages the member is learning, in profile order: the icebreaker comes in one of them. */
export function usePracticeLanguages(): PracticeLanguage[] {
  const profile = useProfile();
  const learning = profile.data?.learningLanguages;
  return useMemo(
    () =>
      (learning ?? []).map((language) => ({
        id: language.languageId,
        name: language.name,
        flagEmoji: language.flagEmoji,
      })),
    [learning],
  );
}

const LANGUAGE_KEY = "icebreaker.language";

/**
 * Which learning language today's icebreaker is in: the one the member picked last time
 * (remembered on this phone) while it is still in their profile, otherwise the first one.
 */
export function useIcebreakerLanguage(languages: PracticeLanguage[]) {
  const [pickedId, setPickedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void preferencesStorage
      .get(LANGUAGE_KEY)
      .then((stored) => {
        if (!cancelled && stored) setPickedId((current) => current ?? stored);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const language = languages.find((item) => item.id === pickedId) ?? languages[0];

  const select = useCallback((languageId: string) => {
    setPickedId(languageId);
    void preferencesStorage.set(LANGUAGE_KEY, languageId).catch(() => undefined);
  }, []);

  return { language, select };
}

export function useTodayIcebreaker(languageId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.icebreakers.today(languageId ?? ""),
    queryFn: () => getTodayIcebreaker(languageId ?? ""),
    enabled: Boolean(languageId),
    staleTime: 5 * 60_000,
  });
}

export function useIcebreakerAnswers(languageId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.icebreakers.answers(languageId),
    queryFn: ({ pageParam }) => getIcebreakerAnswers(languageId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** Save or delete my answer; today's card updates at once. */
export function useMyIcebreakerAnswer(languageId: string) {
  const queryClient = useQueryClient();
  const todayKey = queryKeys.icebreakers.today(languageId);

  const setMine = (myAnswer: IcebreakerTodayDto["myAnswer"]) =>
    queryClient.setQueryData<IcebreakerTodayDto>(todayKey, (current) =>
      current ? { ...current, myAnswer } : current,
    );

  const save = useMutation({
    mutationFn: (body: string) => saveIcebreakerAnswer({ languageId, body }),
    onSuccess: (saved) => setMine(saved),
  });

  const remove = useMutation({
    mutationFn: () => deleteIcebreakerAnswer(languageId),
    onSuccess: () => setMine(null),
  });

  return { save, remove };
}
