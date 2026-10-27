import { MAX_AGE, MIN_AGE } from "@sayly/shared";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** Calendar date → "YYYY-MM-DD" from the local day the user picked (never shifted by UTC). */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "YYYY-MM-DD" → local Date at midnight, or null if it is not a real calendar date. */
export function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

function yearsBefore(today: Date, years: number) {
  return new Date(today.getFullYear() - years, today.getMonth(), today.getDate());
}

/** Selectable range: at most 120 years ago, at least 18 years ago (so never in the future). */
export function dateOfBirthBounds(today = new Date()) {
  return { minimumDate: yearsBefore(today, MAX_AGE), maximumDate: yearsBefore(today, MIN_AGE) };
}

/** null when valid, otherwise a user-facing message. "" (not set) is valid. */
export function dateOfBirthError(value: string, today = new Date()): string | null {
  if (!value) return null;
  const date = parseIsoDate(value);
  if (!date) return "Choose your date of birth from the calendar";
  if (date > today) return "Date of birth cannot be in the future";
  const { minimumDate, maximumDate } = dateOfBirthBounds(today);
  if (date > maximumDate) return `You must be at least ${MIN_AGE} years old`;
  if (date < minimumDate) return "Please check the year";
  return null;
}

/** e.g. "14 March 1998". */
export function formatDateOfBirth(value: string): string {
  const date = parseIsoDate(value);
  return date
    ? date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "";
}
