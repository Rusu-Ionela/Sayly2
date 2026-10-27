import { STREAK_REMINDER_WINDOW } from "@sayly/shared";
import { sql } from "drizzle-orm";

import { db } from "../../db/client";
import { logger } from "../../shared/utils/logger";
import { sendStreakReminders } from "../notifications";

/** Members claimed per round trip; a tick keeps claiming until fewer come back. */
const BATCH_SIZE = 500;
const MAX_BATCHES_PER_TICK = 20;

export type DueReminder = { userId: string; currentStreak: number };

/**
 * Atomically claims members to remind now and marks them reminded for their local today.
 * Due means: active account, reminders on, a phone registered, a streak that was alive
 * yesterday but has no activity today, and an evening hour in the member's time zone.
 * The UPDATE re-checks `lastReminderDate`, so parallel API instances never double-send.
 */
export async function claimDueReminders(at: Date, limit = BATCH_SIZE): Promise<DueReminder[]> {
  const result = await db.execute<{ userId: string; currentStreak: number }>(claimDueRemindersQuery(at, limit));
  return result.rows.map((row) => ({ userId: row.userId, currentStreak: Number(row.currentStreak) }));
}

/** The claiming statement on its own (also lets ops EXPLAIN it without running it). */
export function claimDueRemindersQuery(at: Date, limit = BATCH_SIZE) {
  const now = sql`${at.toISOString()}::timestamptz`;
  const localNow = sql`(${now} AT TIME ZONE s."timezone")`;
  return sql`
    WITH due AS (
      SELECT s."userId", (${localNow})::date AS local_today
      FROM "UserStreak" s
      JOIN "User" u ON u."id" = s."userId"
      LEFT JOIN "UserSettings" us ON us."userId" = s."userId"
      WHERE u."status" = 'ACTIVE'
        AND COALESCE(us."notifyStreakReminders", true)
        AND s."currentStreak" > 0
        -- Zones Postgres does not know would fail the whole statement; skip them.
        AND s."timezone" IN (SELECT "name" FROM pg_timezone_names)
        AND EXTRACT(HOUR FROM ${localNow}) >= ${STREAK_REMINDER_WINDOW.fromHour}
        AND EXTRACT(HOUR FROM ${localNow}) < ${STREAK_REMINDER_WINDOW.toHour}
        AND s."lastActiveDate" = (${localNow})::date - 1
        AND (s."lastReminderDate" IS NULL OR s."lastReminderDate" < (${localNow})::date)
        AND EXISTS (SELECT 1 FROM "PushToken" p WHERE p."userId" = s."userId")
      LIMIT ${limit}
    )
    UPDATE "UserStreak" s
    SET "lastReminderDate" = due.local_today
    FROM due
    WHERE s."userId" = due."userId"
      AND (s."lastReminderDate" IS NULL OR s."lastReminderDate" < due.local_today)
    RETURNING s."userId" AS "userId", s."currentStreak" AS "currentStreak"
  `;
}

/** One pass: claim and notify everyone due right now. */
export async function runStreakReminders(at: Date = new Date()): Promise<number> {
  let reminded = 0;
  for (let batch = 0; batch < MAX_BATCHES_PER_TICK; batch += 1) {
    const due = await claimDueReminders(at);
    if (due.length === 0) break;
    await sendStreakReminders(due);
    reminded += due.length;
    if (due.length < BATCH_SIZE) break;
  }
  if (reminded > 0) {
    logger.info("streaks", "streak reminders sent", { members: reminded });
  }
  return reminded;
}

/**
 * Runs `runStreakReminders` every `intervalMs` on this API process. Every instance may run it:
 * claiming is atomic. Returns a stop function for graceful shutdown.
 */
export function startStreakReminderJob(intervalMs = 10 * 60 * 1000): () => void {
  let running = false;
  const tick = () => {
    if (running) return;
    running = true;
    runStreakReminders()
      .catch((error: unknown) =>
        logger.warn("streaks", "streak reminder run failed", {
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
