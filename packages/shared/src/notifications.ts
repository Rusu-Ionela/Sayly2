/**
 * The `data` payload of a push notification: tells the app what to open when it is tapped.
 * Expo delivers `data` as JSON, so every value is a string.
 */
export type PushData =
  | { type: "message"; conversationId: string }
  | { type: "connection_request" | "connection_accepted"; userId: string }
  | { type: "streak_reminder" };

/**
 * Socket events about language-partner requests, sent to the member they concern so the app
 * can show a banner and refresh Connections while it is open (push only reaches phones).
 */
export const CONNECTION_EVENTS = {
  request: "connection_request",
  accepted: "connection_accepted",
} as const;

/** Payload of both connection events: the other member. */
export type ConnectionEventDto = { userId: string; displayName: string };

/** Android notification channels the API sends to (the app creates them). */
export const PUSH_CHANNELS = {
  default: "default",
  reminders: "reminders",
} as const;

/**
 * Streak reminders go out in the member's evening, in their own time zone: from `fromHour`
 * (inclusive) until `toHour` (exclusive), at most once a day.
 */
export const STREAK_REMINDER_WINDOW = { fromHour: 19, toHour: 23 } as const;
