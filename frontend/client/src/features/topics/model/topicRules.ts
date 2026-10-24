import { isApiError } from "@/lib/api/errors";
import { profileErrorMessage } from "@/features/profile/model/profileErrors";

/** Mirrors backend `topics/schema.ts`. */
const TOPIC_TITLE_MIN = 3;
export const TOPIC_TITLE_MAX = 80;

/** Tap-to-fill starters in the create sheet. */
export const TOPIC_IDEAS = [
  "My hometown and its food",
  "Travel stories",
  "Favourite series right now",
  "Learning tips that work",
  "Music I can't stop playing",
  "Weekend plans",
] as const;

/** Same whitespace rules as the server, so the counter and duplicate check agree. */
export function normalizeTopicTitle(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function topicTitleError(value: string, existing: readonly string[]): string | null {
  const title = normalizeTopicTitle(value);
  if (title.length < TOPIC_TITLE_MIN) return `Use at least ${TOPIC_TITLE_MIN} characters.`;
  if (title.length > TOPIC_TITLE_MAX) return `Keep it under ${TOPIC_TITLE_MAX} characters.`;
  const lower = title.toLocaleLowerCase();
  if (existing.some((item) => item.toLocaleLowerCase() === lower)) {
    return "You already have this topic.";
  }
  return null;
}

export function topicErrorMessage(error: unknown) {
  if (isApiError(error) && error.status === 409 && error.message) return error.message;
  return profileErrorMessage(error);
}
