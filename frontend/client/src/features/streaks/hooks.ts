import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StreakDto } from "@sayly/shared";
import { hashKey, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { useAuth } from "@/features/auth";
import { useSocketContext } from "@/features/chat/socket/SocketProvider";
import { log } from "@/lib/logger";
import { queryKeys } from "@/lib/queryKeys";

import { checkIn, getMyStreak } from "./api";
import {
  celebrationFor,
  deviceTimeZone,
  localToday,
  shouldCelebrate,
  streakForToday,
  type StreakCelebration,
} from "./model";

export function useStreak() {
  return useQuery({
    queryKey: queryKeys.streak.me,
    queryFn: getMyStreak,
    select: (streak) => streakForToday(streak),
  });
}

/**
 * Keeps the streak live while signed in: checks in once per local day when the app opens or
 * comes back to the foreground, and takes `streak_updated` pushes (a message sent from another
 * device, an icebreaker answer).
 */
export function useStreakSync() {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocketContext();
  const checkedInOn = useRef<string | null>(null);

  useEffect(() => {
    const run = () => {
      const today = localToday();
      if (checkedInOn.current === today) return;
      checkedInOn.current = today;
      checkIn(deviceTimeZone())
        .then((streak) => queryClient.setQueryData(queryKeys.streak.me, streak))
        .catch((error: unknown) => {
          // Try again on the next foreground.
          checkedInOn.current = null;
          log.warn("streaks", "check-in failed", {
            message: error instanceof Error ? error.message : "unknown",
          });
        });
    };

    run();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") run();
    });
    return () => subscription.remove();
  }, [queryClient]);

  useEffect(() => {
    if (!socket || !isConnected) return;
    const onUpdated = (streak: StreakDto) => queryClient.setQueryData(queryKeys.streak.me, streak);
    socket.on("streak_updated", onUpdated);
    return () => {
      socket.off("streak_updated", onUpdated);
    };
  }, [socket, isConnected, queryClient]);
}

const previewListeners = new Set<() => void>();

/** Dev builds only: shows the overlay for the current streak, without touching the stored day. */
export function previewStreakCelebration() {
  if (__DEV__) previewListeners.forEach((listener) => listener());
}

const celebratedKey = (userId: string) => `sayly.streak.celebratedOn.${userId}`;

/**
 * Watches the streak in the query cache, whichever path updated it (check-in, socket push,
 * refetch), and returns a celebration when today has just started counting. At most once
 * per day per member on this device; the day is remembered across restarts.
 */
export function useStreakCelebration() {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const [celebration, setCelebration] = useState<StreakCelebration | null>(null);

  useEffect(() => {
    if (!userId) return;
    const storageKey = celebratedKey(userId);
    const streakHash = hashKey(queryKeys.streak.me);
    let cancelled = false;
    // undefined until the stored day has loaded; decisions wait for it.
    let celebratedOn: string | null | undefined;
    let previous = queryClient.getQueryData<StreakDto>(queryKeys.streak.me);
    let waiting: { previous: StreakDto | undefined; next: StreakDto } | null = null;

    const decide = (before: StreakDto | undefined, next: StreakDto) => {
      if (celebratedOn === undefined) {
        // Keep the oldest "before": it decides whether today has just started counting.
        waiting = { previous: waiting ? waiting.previous : before, next };
        return;
      }
      if (!shouldCelebrate(before, next, celebratedOn)) return;
      celebratedOn = next.today;
      void AsyncStorage.setItem(storageKey, next.today).catch(() => undefined);
      setCelebration(celebrationFor(next));
    };

    AsyncStorage.getItem(storageKey)
      .catch(() => null)
      .then((stored) => {
        if (cancelled) return;
        celebratedOn = stored;
        if (waiting) {
          const { previous: before, next } = waiting;
          waiting = null;
          decide(before, next);
        }
      });

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.query.queryHash !== streakHash) return;
      const next = event.query.state.data as StreakDto | undefined;
      if (!next) return;
      // Only fresh server answers can celebrate; a restored cache just becomes the baseline.
      if (event.type === "updated" && event.action.type === "success") {
        decide(previous, next);
      }
      previous = next;
    });

    const preview = () => {
      const streak = queryClient.getQueryData<StreakDto>(queryKeys.streak.me);
      if (streak)
        setCelebration(celebrationFor({ ...streak, current: Math.max(streak.current, 1) }));
    };
    previewListeners.add(preview);

    return () => {
      cancelled = true;
      unsubscribe();
      previewListeners.delete(preview);
    };
  }, [queryClient, userId]);

  const dismiss = useCallback(() => setCelebration(null), []);
  return { celebration, dismiss };
}
