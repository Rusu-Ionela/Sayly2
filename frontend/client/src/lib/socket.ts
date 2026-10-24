import { io, type Socket } from "socket.io-client";

import { authStorage } from "@/features/auth/authStorage";
import { API_BASE_URL, getFreshAccessToken } from "@/lib/apiClient";

let socket: Socket | null = null;
let getAccessToken: () => string | null = () => null;

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
        void handshakeToken().then((token) => cb(token ? { token } : {}));
      },
    });
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
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
