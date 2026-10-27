import { and, eq, inArray, ne, sql } from "drizzle-orm";

import { db } from "../../db/client";
import { userStreaks, type UserStreak } from "../../db/schema";

export type StreakRow = Pick<UserStreak, "currentStreak" | "longestStreak" | "lastActiveDate" | "timezone">;

const columns = {
  currentStreak: userStreaks.currentStreak,
  longestStreak: userStreaks.longestStreak,
  lastActiveDate: userStreaks.lastActiveDate,
  timezone: userStreaks.timezone,
};

export async function findStreak(userId: string): Promise<StreakRow | null> {
  const [row] = await db.select(columns).from(userStreaks).where(eq(userStreaks.userId, userId)).limit(1);
  return row ?? null;
}

/** Streak rows of several members; members who never had activity are simply absent. */
export async function findStreaks(userIds: string[]): Promise<(StreakRow & { userId: string })[]> {
  if (userIds.length === 0) return [];
  return db
    .select({ userId: userStreaks.userId, ...columns })
    .from(userStreaks)
    .where(inArray(userStreaks.userId, userIds));
}

/**
 * Counts `today` for the member in one atomic statement (same rules as `nextStreak` in
 * @sayly/shared). Returns the row when this call moved the streak, or null when today was
 * already counted, so concurrent sends never double-count.
 */
export async function countActiveDay(
  userId: string,
  today: string,
  timezone: string | undefined,
): Promise<StreakRow | null> {
  const nextCurrent = sql<number>`CASE WHEN ${userStreaks.lastActiveDate} = (${today}::date - 1)
    THEN ${userStreaks.currentStreak} + 1 ELSE 1 END`;

  const [row] = await db
    .insert(userStreaks)
    .values({
      userId,
      currentStreak: 1,
      longestStreak: 1,
      lastActiveDate: today,
      ...(timezone ? { timezone } : {}),
    })
    .onConflictDoUpdate({
      target: userStreaks.userId,
      set: {
        currentStreak: nextCurrent,
        longestStreak: sql`GREATEST(${userStreaks.longestStreak}, ${nextCurrent})`,
        lastActiveDate: today,
        ...(timezone ? { timezone } : {}),
        updatedAt: new Date(),
      },
      // A day at or before the last counted one (already counted, or a time zone moved back) is a no-op.
      setWhere: sql`${userStreaks.lastActiveDate} IS NULL OR ${userStreaks.lastActiveDate} < ${today}::date`,
    })
    .returning(columns);

  return row ?? null;
}

/** Keeps the member's time zone current when today was already counted. */
export async function updateTimeZone(userId: string, timezone: string) {
  await db
    .update(userStreaks)
    .set({ timezone, updatedAt: new Date() })
    .where(and(eq(userStreaks.userId, userId), ne(userStreaks.timezone, timezone)));
}
