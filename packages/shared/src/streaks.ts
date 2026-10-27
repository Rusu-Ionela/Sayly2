/** A member's daily streak as the API returns it. Dates are "YYYY-MM-DD" in the member's time zone. */
export type StreakDto = {
  /** Days in a row, counting today or yesterday; 0 once a day was missed. */
  current: number;
  longest: number;
  lastActiveDate: string | null;
  /** True when today already counts, so the streak is safe until tomorrow. */
  activeToday: boolean;
  /** The member's "today", in their time zone. */
  today: string;
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "YYYY-MM-DD" shifted by whole days (calendar math in UTC, so no DST surprises). */
export function addDays(isoDate: string, days: number): string {
  const match = ISO_DATE.exec(isoDate);
  if (!match) throw new Error(`Invalid date: ${isoDate}`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return date.toISOString().slice(0, 10);
}

/**
 * Streak after one more active day. Same day: unchanged. The day after: +1. Any later day: a
 * new streak of 1. A day before the last one (the member changed time zone) changes nothing.
 */
export function nextStreak(
  state: { current: number; longest: number; lastActiveDate: string | null },
  today: string,
): { current: number; longest: number; lastActiveDate: string } {
  const last = state.lastActiveDate;
  if (last !== null && last >= today) {
    return {
      current: state.current,
      longest: state.longest,
      lastActiveDate: last,
    };
  }
  const current = last !== null && addDays(last, 1) === today ? state.current + 1 : 1;
  return {
    current,
    longest: Math.max(state.longest, current),
    lastActiveDate: today,
  };
}

/** What to show today: a streak whose last day is before yesterday is already broken. */
export function streakAsOf(
  state: { current: number; longest: number; lastActiveDate: string | null },
  today: string,
): StreakDto {
  const last = state.lastActiveDate;
  const alive = last !== null && (last >= today || addDays(last, 1) === today);
  return {
    current: alive ? state.current : 0,
    longest: state.longest,
    lastActiveDate: last,
    activeToday: last !== null && last >= today,
    today,
  };
}
