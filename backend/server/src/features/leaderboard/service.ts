import {
  LEADERBOARD_REWARD_DAYS,
  leaderboardWeekEnd,
  leaderboardWeekStart,
  rankByStreak,
  type FriendsLeaderboardDto,
} from "@sayly/shared";

import { logger } from "../../shared/utils/logger";
import { listAcceptedPartnerIds } from "../connections/repository";
import { findStreaks } from "../streaks/repository";
import { streakNow } from "../streaks/service";
import { loadMemberSummaries } from "../users/memberSummary";

import * as repository from "./repository";

const DAY_MS = 24 * 60 * 60 * 1000;

/** GET /leaderboard/friends — you and your accepted partners, longest live streak first. */
export async function getFriendsLeaderboard(
  userId: string,
  now: Date = new Date(),
): Promise<FriendsLeaderboardDto> {
  const ids = [userId, ...(await listAcceptedPartnerIds(userId))];
  const [members, streakRows, proUntil] = await Promise.all([
    loadMemberSummaries(ids),
    findStreaks(ids),
    repository.findProUntil(userId),
  ]);
  const streaks = new Map(streakRows.map((row) => [row.userId, row]));

  const rows = ids.flatMap((id) => {
    const member = members.get(id);
    if (!member) return [];
    const streak = streakNow(streaks.get(id) ?? null, now);
    return [
      {
        userId: id,
        displayName: member.displayName,
        avatarUrl: member.avatarUrl,
        isPro: member.isPro,
        currentStreak: streak.current,
        activeToday: streak.activeToday,
        isMe: id === userId,
      },
    ];
  });

  return {
    entries: rankByStreak(rows),
    weekEndsAt: leaderboardWeekEnd(now).toISOString(),
    rewardDays: LEADERBOARD_REWARD_DAYS,
    rewardProUntil: proUntil && proUntil > now ? proUntil.toISOString() : null,
  };
}

/**
 * Pays last week's winners. Only runs during the first day of a new week (Monday UTC), so a
 * server that was down all Monday does not hand out rewards for a half-finished week.
 */
export async function runWeeklyRewards(at: Date = new Date()): Promise<string[]> {
  const weekStart = leaderboardWeekStart(at);
  if (at.getTime() - weekStart.getTime() >= DAY_MS) {
    return [];
  }
  const winners = await repository.grantWeeklyRewards(
    at,
    weekStart,
    new Date(at.getTime() + LEADERBOARD_REWARD_DAYS * DAY_MS),
  );
  if (winners.length > 0) {
    logger.info("leaderboard", "weekly Pro rewards granted", { members: winners.length });
  }
  return winners;
}

/** Checks for rewards every `intervalMs` on this process (granting is atomic and idempotent). */
export function startWeeklyRewardJob(intervalMs = 15 * 60 * 1000): () => void {
  let running = false;
  const tick = () => {
    if (running) return;
    running = true;
    runWeeklyRewards()
      .catch((error: unknown) =>
        logger.warn("leaderboard", "weekly reward run failed", {
          message: error instanceof Error ? error.message : "Unknown error",
        }),
      )
      .finally(() => {
        running = false;
      });
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  tick();
  return () => clearInterval(timer);
}
