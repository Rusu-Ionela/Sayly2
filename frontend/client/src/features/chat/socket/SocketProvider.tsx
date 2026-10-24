import NetInfo from "@react-native-community/netinfo";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import type { Socket } from "socket.io-client";

import { useAuth } from "@/features/auth";
import { useCurrentUser } from "@/features/onboarding";
import { log } from "@/lib/logger";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import { getSocket, reconnectSocketNow, resetSocket } from "@/lib/socket";

import { needsManualReconnect, QUIET_ATTEMPTS, reconnectDelayMs } from "./reconnectPolicy";

type SocketStatus = "disconnected" | "connecting" | "connected" | "error";

type SocketContextValue = {
  socket: Socket | null;
  status: SocketStatus;
  isConnected: boolean;
  emit: <T = unknown>(event: string, payload?: unknown) => Promise<T>;
};

const SocketContext = createContext<SocketContextValue | null>(null);

/** Everything that may have changed while the socket was down is fetched again. */
function syncAfterReconnect() {
  for (const queryKey of [
    queryKeys.chat.conversations,
    // Prefix of every conversation's message list (queryKeys.chat.messages(id)).
    ["messages"],
    queryKeys.follows.all,
    queryKeys.groups.all,
  ]) {
    void queryClient.invalidateQueries({ queryKey });
  }
}

/**
 * Owns the authenticated Socket.IO lifecycle once after sign-in, and keeps it alive:
 * - transport drops retry with exponential backoff (socket.io itself);
 * - server-side closes (expired token) and rejected handshakes retry with the same
 *   backoff, each attempt with a freshly refreshed token (see lib/socket);
 * - coming back to the foreground or getting the network back reconnects at once;
 * - every (re)connect re-syncs conversations and messages missed while offline.
 * Feature hooks subscribe to events; they must not disconnect the singleton on unmount.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth();
  const meQuery = useCurrentUser(isSignedIn);
  const shouldConnect = isSignedIn && meQuery.data?.onboardingCompleted === true;
  const [status, setStatus] = useState<SocketStatus>("disconnected");
  const [socket, setSocket] = useState<Socket | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!shouldConnect) {
      resetSocket();
      setSocket(null);
      setStatus("disconnected");
      return;
    }

    const instance = getSocket();
    let cancelled = false;
    let failedAttempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let wasOnline = true;

    const update = (next: SocketStatus) => {
      if (!cancelled && mounted.current) setStatus(next);
    };
    const clearRetry = () => {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
    };
    const connectNow = () => {
      clearRetry();
      if (cancelled || instance.connected) return;
      update("connecting");
      reconnectSocketNow();
    };
    const scheduleRetry = () => {
      clearRetry();
      const delayMs = reconnectDelayMs(failedAttempts);
      log.info("socket", "reconnect scheduled", { attempt: failedAttempts + 1, delayMs });
      retryTimer = setTimeout(connectNow, delayMs);
    };

    const onConnect = () => {
      if (failedAttempts > 0) log.info("socket", "reconnected");
      failedAttempts = 0;
      clearRetry();
      update("connected");
      syncAfterReconnect();
    };
    const onDisconnect = (reason: string) => {
      if (cancelled) return;
      log.info("socket", "disconnected", { reason });
      update("connecting");
      if (needsManualReconnect(reason)) scheduleRetry();
    };
    const onConnectError = (error: Error) => {
      if (cancelled) return;
      failedAttempts += 1;
      log.info("socket", "connect failed", { attempt: failedAttempts, message: error.message });
      update(failedAttempts >= QUIET_ATTEMPTS ? "error" : "connecting");
      // A rejected handshake (e.g. expired token) stops socket.io's own retries.
      if (!instance.active) scheduleRetry();
    };

    const onGroupMembership = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.groups.all });
    };
    const onGroupMessage = () => {
      void queryClient.invalidateQueries({ queryKey: ["groups", "list"] });
    };

    instance.on("connect", onConnect);
    instance.on("disconnect", onDisconnect);
    instance.on("connect_error", onConnectError);
    instance.on("group_membership", onGroupMembership);
    instance.on("group_message_new", onGroupMessage);
    setSocket(instance);

    // iOS suspends sockets in the background: reconnect the moment the app is visible.
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active" && !instance.connected) {
        failedAttempts = 0;
        connectNow();
      }
    });
    // Wi-Fi <-> cellular switches and coming back online: do not wait for the backoff.
    const unsubscribeNetInfo = NetInfo.addEventListener((net) => {
      const online = net.isConnected === true && net.isInternetReachable !== false;
      if (online && !wasOnline && !instance.connected) {
        failedAttempts = 0;
        connectNow();
      }
      wasOnline = online;
    });

    if (instance.connected) {
      onConnect();
    } else {
      update("connecting");
      instance.connect();
    }

    return () => {
      cancelled = true;
      clearRetry();
      appState.remove();
      unsubscribeNetInfo();
      instance.off("connect", onConnect);
      instance.off("disconnect", onDisconnect);
      instance.off("connect_error", onConnectError);
      instance.off("group_membership", onGroupMembership);
      instance.off("group_message_new", onGroupMessage);
    };
  }, [shouldConnect]);

  const emit = useCallback(<T = unknown,>(event: string, payload?: unknown) => {
    return new Promise<T>((resolve, reject) => {
      const current = getSocket();
      if (!current.connected) {
        reject(new Error("Socket is not connected"));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error("Socket ack timed out"));
      }, 8_000);

      current.emit(event, payload, (response: T & { ok?: boolean; error?: string }) => {
        clearTimeout(timeout);
        if (response && typeof response === "object" && "ok" in response && response.ok === false) {
          reject(new Error(response.error ?? "Socket request failed"));
          return;
        }
        resolve(response);
      });
    });
  }, []);

  const value = useMemo<SocketContextValue>(
    () => ({
      socket,
      status,
      isConnected: status === "connected",
      emit,
    }),
    [socket, status, emit],
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocketContext() {
  const value = useContext(SocketContext);
  if (!value) {
    throw new Error("useSocketContext must be used within SocketProvider");
  }
  return value;
}
