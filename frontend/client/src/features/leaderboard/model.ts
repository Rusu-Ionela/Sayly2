import type { LeaderboardEntryDto } from "@sayly/shared";

const HOUR_MS = 60 * 60 * 1000;

/** The top three go on the podium; everyone else goes in the list below. */
export function splitPodium(entries: LeaderboardEntryDto[]) {
  return { podium: entries.slice(0, 3), rest: entries.slice(3) };
}

/** Podium columns left to right: 2nd, 1st, 3rd (only the places that exist). */
export function podiumOrder<T>(podium: T[]): T[] {
  const [first, second, third] = podium;
  return [second, first, third].filter((item): item is T => item !== undefined);
}

/** "4 zile", "1 zi", "5 ore" until the race closes. */
export function timeLeftLabel(weekEndsAt: string, now: Date = new Date()): string {
  const hours = Math.max(0, Math.ceil((new Date(weekEndsAt).getTime() - now.getTime()) / HOUR_MS));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return days === 1 ? "1 zi" : `${days} zile`;
  }
  return hours === 1 ? "1 oră" : `${hours} ore`;
}

export function daysLabel(days: number) {
  return `${days} ${days === 1 ? "day" : "days"}`;
}
