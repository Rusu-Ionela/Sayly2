/** Manual retries (when socket.io gives up by design) back off like its own: 1s → 30s. */
const RECONNECT_BASE_MS = 1_000;
export const RECONNECT_MAX_MS = 30_000;
/** After this many failed attempts in a row the UI says "unavailable", not "reconnecting". */
export const QUIET_ATTEMPTS = 3;

/**
 * Delay before retry number `attempt` (0-based): exponential with ±50% jitter so many
 * phones that lost the same Wi-Fi do not all reconnect at the same instant.
 */
export function reconnectDelayMs(attempt: number, random: () => number = Math.random): number {
  const exponential = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** Math.max(0, attempt));
  const jittered = exponential * (0.5 + random());
  return Math.round(Math.min(RECONNECT_MAX_MS, jittered));
}

/**
 * Whether socket.io will retry on its own after this disconnect. It does for transport
 * problems; it does not when the server closed the socket (e.g. expired token).
 */
export function needsManualReconnect(reason: string): boolean {
  return reason === "io server disconnect";
}
