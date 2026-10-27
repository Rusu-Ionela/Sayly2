/** True for IANA zones Node knows (e.g. "Europe/Bucharest"); rejects junk before it reaches the DB. */
export function isValidTimeZone(value: string): boolean {
  if (!value || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Calendar day ("YYYY-MM-DD") of `at` in `timeZone`; falls back to UTC for an unknown zone. */
export function localDateIn(timeZone: string, at: Date = new Date()): string {
  const zone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}
