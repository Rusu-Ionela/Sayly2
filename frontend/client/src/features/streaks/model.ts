import { streakAsOf, type StreakDto } from "@sayly/shared";

/** The device's calendar day, "YYYY-MM-DD". */
export function localToday(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** IANA zone of the device (e.g. "Europe/Bucharest"), when the JS engine exposes it. */
export function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/**
 * The streak as of the device's today: a cached copy from yesterday must not keep showing a
 * streak that has since been broken, or claim today is already done.
 */
export function streakForToday(streak: StreakDto, today: string = localToday()): StreakDto {
  if (streak.today === today) return streak;
  return streakAsOf(
    { current: streak.current, longest: streak.longest, lastActiveDate: streak.lastActiveDate },
    today,
  );
}

export function streakLabel(streak: StreakDto): string {
  if (streak.current === 0) return "Start your streak today";
  const days = streak.current === 1 ? "1 day" : `${streak.current} days`;
  return streak.activeToday ? `${days} streak` : `${days} streak, practise today to keep it`;
}

/** What the celebration overlay shows: the count rolls from `from` to `to`. */
export type StreakCelebration = {
  from: number;
  to: number;
  longest: number;
  /** A new personal best (more than one day, and at least the longest so far). */
  isBest: boolean;
};

/**
 * Celebrate when today has just started counting: the server says today counts, the copy
 * we held before did not (or we had none), and this device has not celebrated today yet.
 * `celebratedOn` is the last day this member saw the overlay on this device.
 */
export function shouldCelebrate(
  previous: StreakDto | undefined,
  next: StreakDto,
  celebratedOn: string | null,
): boolean {
  if (!next.activeToday || next.current < 1) return false;
  if (celebratedOn === next.today) return false;
  const before = previous ? streakForToday(previous, next.today) : undefined;
  return !before?.activeToday;
}

export function celebrationFor(next: StreakDto): StreakCelebration {
  return {
    from: Math.max(0, next.current - 1),
    to: next.current,
    longest: next.longest,
    isBest: next.current > 1 && next.current >= next.longest,
  };
}

export function celebrationCopy(celebration: StreakCelebration): { title: string; body: string } {
  if (celebration.to === 1) {
    return {
      title: "Streak started!",
      body: "Day one is done. Come back tomorrow to keep the flame going.",
    };
  }
  return {
    title: celebration.isBest ? "New personal best!" : `${celebration.to}-day streak!`,
    body: celebration.isBest
      ? `${celebration.to} days in a row, your longest ever. Keep it burning tomorrow.`
      : "You practised today. Come back tomorrow to keep the flame going.",
  };
}
