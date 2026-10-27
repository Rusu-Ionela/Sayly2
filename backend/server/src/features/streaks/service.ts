import { streakAsOf, type StreakDto } from "@sayly/shared";

import { logger } from "../../shared/utils/logger";
import { emitToUsers } from "../messaging/gateway";

import * as repository from "./repository";
import { localDateIn } from "./timezone";

const EMPTY = { current: 0, longest: 0, lastActiveDate: null };

function toDto(row: repository.StreakRow | null, today: string): StreakDto {
  return streakAsOf(
    row
      ? { current: row.currentStreak, longest: row.longestStreak, lastActiveDate: row.lastActiveDate }
      : EMPTY,
    today,
  );
}

/** A stored row (or none) as the member's streak right now, in their own time zone. */
export function streakNow(row: repository.StreakRow | null, now: Date = new Date()): StreakDto {
  return toDto(row, localDateIn(row?.timezone ?? "UTC", now));
}

export async function getStreak(userId: string): Promise<StreakDto> {
  return streakNow(await repository.findStreak(userId));
}

/**
 * Counts today for the member (app opened, message sent, icebreaker answered). Only the
 * first activity of a day writes; the member's devices get `streak_updated` when it moves.
 * `timezone` comes from the app's check-in; other activity uses the zone stored last time.
 */
export async function recordActivity(userId: string, timezone?: string): Promise<StreakDto> {
  const existing = await repository.findStreak(userId);
  const zone = timezone ?? existing?.timezone ?? "UTC";
  const today = localDateIn(zone);

  if (existing?.lastActiveDate && existing.lastActiveDate >= today) {
    if (timezone && timezone !== existing.timezone) {
      await repository.updateTimeZone(userId, timezone);
    }
    return toDto(existing, today);
  }

  const updated = await repository.countActiveDay(userId, today, timezone);
  if (!updated) {
    // Another request counted today first.
    return getStreak(userId);
  }
  const dto = toDto(updated, today);
  emitToUsers([userId], "streak_updated", dto);
  return dto;
}

/** For activity hooks (sending a message…): a streak failure must never fail the action. */
export function recordActivityInBackground(userId: string) {
  void recordActivity(userId).catch((error: unknown) => {
    logger.warn("streaks", "activity not counted", {
      userId,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  });
}
