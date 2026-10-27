import { io, type Socket } from "socket.io-client";

import { authStorage } from "@/features/auth/authStorage";
import { API_BASE_URL, getFreshAccessToken, jwtExpiresAtMs } from "@/lib/apiClient";
import { log } from "@/lib/logger";

let socket: Socket | null = null;
let getAccessToken: () => string | null = () => null;
/** Token sent with the last handshake/reauth; its expiry sets the next reauth. */
let currentToken: string | null = null;
let reauthTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Reauth this long before the token expires. Under the API client's 60 s refresh margin,
 * so getFreshAccessToken() really refreshes instead of handing back the dying token.
 */
const REAUTH_BEFORE_EXPIRY_MS = 45_000;
const REAUTH_MIN_DELAY_MS = 5_000;
const REAUTH_RETRY_MS = 10_000;
const REAUTH_ACK_TIMEOUT_MS = 8_000;

/**
 * Delay until the next reauth for a token expiring at `expiresAtMs`, or null if unknown.
 * @public Exported for socketReauth.test, which loads this module with require.
 */
export function reauthDelayMs(expiresAtMs: number | null, now = Date.now()): number | null {
  if (expiresAtMs === null) return null;
  return Math.max(REAUTH_MIN_DELAY_MS, expiresAtMs - now - REAUTH_BEFORE_EXPIRY_MS);
}

/** Fallback token source (in-memory session) when the API client has none yet. */
export function configureSocketAuth(getter: () => string | null) {
  getAccessToken = getter;
}

/**
 * Token for every (re)connection handshake. The server closes sockets whose access token
 * expired, so each attempt asks for one that is still valid — refreshing it if needed.
 */
async function handshakeToken(): Promise<string | null> {
  const fresh = await getFreshAccessToken().catch(() => null);
  if (fresh) return fresh;
  const memory = getAccessToken();
  if (memory) return memory;
  // Native fallback: SecureStore. Web access tokens are memory-only.
  const stored = await authStorage.getTokens().catch(() => null);
  return stored?.accessToken ?? null;
}

function clearReauth() {
  if (reauthTimer) {
    clearTimeout(reauthTimer);
    reauthTimer = null;
  }
}

function scheduleReauth(instance: Socket, delayMs: number | null) {
  clearReauth();
  if (delayMs === null) return;
  reauthTimer = setTimeout(() => void reauth(instance), delayMs);
}

/**
 * The server closes a socket when its access token expires, which would also end a live
 * call or party room. Before that, hand it a fresh token on the same connection.
 * If this fails the server disconnects and SocketProvider reconnects as usual.
 */
async function reauth(instance: Socket) {
  reauthTimer = null;
  if (!instance.connected) return;
  const token = await getFreshAccessToken().catch(() => null);
  if (!token || !instance.connected) return;
  instance
    .timeout(REAUTH_ACK_TIMEOUT_MS)
    .emit("reauth", { token }, (error: Error | null, result?: { ok?: boolean }) => {
      if (!error && result?.ok) {
        currentToken = token;
        scheduleReauth(instance, reauthDelayMs(jwtExpiresAtMs(token)));
        return;
      }
      log.warn("socket", "reauth failed", { timeout: Boolean(error) });
      if (instance.connected) scheduleReauth(instance, REAUTH_RETRY_MS);
    });
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_BASE_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      // Transport drops (network change, iOS background) retry by themselves with
      // exponential backoff: 1s, 2s, 4s … capped at 30s, ±50% jitter.
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 30_000,
      randomizationFactor: 0.5,
      timeout: 8_000,
      auth: (cb) => {
        void handshakeToken().then((token) => {
          currentToken = token;
          cb(token ? { token } : {});
        });
      },
    });
    const instance = socket;
    instance.on("connect", () =>
      scheduleReauth(instance, reauthDelayMs(currentToken ? jwtExpiresAtMs(currentToken) : null)),
    );
    instance.on("disconnect", clearReauth);
  }

  return socket;
}

/**
 * Connect now instead of waiting for the next backoff step (app back in foreground,
 * network regained). A no-op while connected.
 */
export function reconnectSocketNow() {
  const instance = getSocket();
  if (instance.connected) return;
  // disconnect() clears any pending backoff timer; connect() starts a fresh attempt.
  instance.disconnect();
  instance.connect();
}

export function resetSocket() {
  clearReauth();
  currentToken = null;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
