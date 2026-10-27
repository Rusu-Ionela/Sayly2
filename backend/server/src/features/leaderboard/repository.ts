import { eq, sql } from "drizzle-orm";

import { db } from "../../db/client";
import { users } from "../../db/schema";

export async function findProUntil(userId: string): Promise<Date | null> {
  const [row] = await db
    .select({ proUntil: users.proUntil })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.proUntil ?? null;
}

/**
 * Gives `rewardUntil` of Pro to every weekly winner and returns their ids. A winner is an
 * active member with a live streak (> 0) and at least one accepted partner, whose streak is
 * at least as long as each partner's (ties share first place). A streak is live when its last
 * day is today or yesterday in the member's own time zone, the same rule as `streakAsOf`.
 *
 * Idempotent per week: a member whose Pro already lasts past `weekStart + 1 day` was paid
 * for this week, so parallel instances and repeated ticks never extend it twice.
 */
export async function grantWeeklyRewards(at: Date, weekStart: Date, rewardUntil: Date): Promise<string[]> {
  const now = sql`${at.toISOString()}::timestamptz`;
  const paidMark = sql`(${weekStart.toISOString()}::timestamptz + interval '1 day') AT TIME ZONE 'UTC'`;
  const until = sql`${rewardUntil.toISOString()}::timestamptz AT TIME ZONE 'UTC'`;

  const result = await db.execute<{ id: string }>(sql`
    WITH live AS (
      SELECT s."userId",
        CASE
          WHEN s."lastActiveDate" >= (${now} AT TIME ZONE s."timezone")::date - 1 THEN s."currentStreak"
          ELSE 0
        END AS streak
      FROM "UserStreak" s
      JOIN "User" u ON u."id" = s."userId"
      WHERE u."status" = 'ACTIVE'
        AND u."onboardingCompleted"
        -- Zones Postgres does not know would fail the whole statement; skip them.
        AND s."timezone" IN (SELECT "name" FROM pg_timezone_names)
    ),
    pairs AS (
      SELECT "requesterId" AS member, "recipientId" AS friend FROM "Connection" WHERE "status" = 'ACCEPTED'
      UNION ALL
      SELECT "recipientId", "requesterId" FROM "Connection" WHERE "status" = 'ACCEPTED'
    ),
    winners AS (
      SELECT p.member
      FROM pairs p
      JOIN live me ON me."userId" = p.member
      JOIN "User" fu ON fu."id" = p.friend AND fu."status" = 'ACTIVE' AND fu."onboardingCompleted"
      LEFT JOIN live f ON f."userId" = p.friend
      WHERE me.streak > 0
      GROUP BY p.member, me.streak
      HAVING me.streak >= MAX(COALESCE(f.streak, 0))
    )
    UPDATE "User" u
    SET "proUntil" = ${until}
    FROM winners w
    WHERE u."id" = w.member
      AND (u."proUntil" IS NULL OR u."proUntil" < ${paidMark})
    RETURNING u."id" AS id
  `);
  return result.rows.map((row) => row.id);
}
