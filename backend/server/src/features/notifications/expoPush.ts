import { logger } from "../../shared/utils/logger";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
/** Expo accepts at most 100 messages per request. */
const BATCH_SIZE = 100;

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  /** Read by the app when the notification is tapped (where to navigate). */
  data: Record<string, string>;
  sound?: "default";
  channelId?: string;
};

type PushTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; details?: { error?: string } };

/**
 * Sends through the Expo push service (FCM on Android, APNs on iOS).
 * Returns the tokens Expo reports as gone, so the caller can forget them.
 * Never throws: a failed push must not break the action that triggered it.
 */
export async function sendExpoPush(
  messages: PushMessage[],
  send: typeof fetch = fetch,
): Promise<string[]> {
  const deadTokens: string[] = [];

  for (let start = 0; start < messages.length; start += BATCH_SIZE) {
    const batch = messages.slice(start, start + BATCH_SIZE);
    try {
      const response = await send(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        logger.warn("push", "expo push request failed", { status: response.status });
        continue;
      }
      const { data } = (await response.json()) as { data?: PushTicket[] };
      (data ?? []).forEach((ticket, index) => {
        if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
          const token = batch[index]?.to;
          if (token) deadTokens.push(token);
        } else if (ticket.status === "error") {
          logger.warn("push", "expo push ticket error", { message: ticket.message });
        }
      });
    } catch (error) {
      logger.warn("push", "expo push unreachable", {
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return deadTokens;
}
