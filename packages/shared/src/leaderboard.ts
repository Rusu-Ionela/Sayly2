/** Days of Sayly Pro the weekly friends-leaderboard winner gets. */
export const LEADERBOARD_REWARD_DAYS = 1;

const DAY_MS = 24 * 60 * 60 * 1000;

/** One row of the friends leaderboard (you included). */
export type LeaderboardEntryDto = {
  /** 1-based; members with the same streak share a rank (1, 1, 3…). */
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isPro: boolean;
  currentStreak: number;
  activeToday: boolean;
  isMe: boolean;
};

export type FriendsLeaderboardDto = {
  entries: LeaderboardEntryDto[];
  /** When this week's race closes (Monday 00:00 UTC). */
  weekEndsAt: string;
  rewardDays: number;
  /** Set while you enjoy a leaderboard Pro reward. */
  rewardProUntil: string | null;
};

/**
 * Sorts by streak (highest first, ties by name) and gives tied members the same rank.
 */
export function rankByStreak<T extends { currentStreak: number; displayName: string }>(
  items: T[],
): (T & { rank: number })[] {
  const sorted = [...items].sort(
    (a, b) => b.currentStreak - a.currentStreak || a.displayName.localeCompare(b.displayName),
  );
  let rank = 0;
  return sorted.map((item, index) => {
    if (index === 0 || item.currentStreak !== sorted[index - 1]?.currentStreak) {
      rank = index + 1;
    }
    return { ...item, rank };
  });
}

/** Start of the leaderboard week that contains `at`: Monday 00:00 UTC. */
export function leaderboardWeekStart(at: Date): Date {
  const day = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const sinceMonday = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - sinceMonday * DAY_MS);
}

/** When the week that contains `at` closes (the next Monday 00:00 UTC). */
export function leaderboardWeekEnd(at: Date): Date {
  return new Date(leaderboardWeekStart(at).getTime() + 7 * DAY_MS);
}
