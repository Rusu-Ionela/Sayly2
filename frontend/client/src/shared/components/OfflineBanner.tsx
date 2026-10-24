import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth";
import { useSocketContext } from "@/features/chat/socket/SocketProvider";
import { useCurrentUser } from "@/features/onboarding";
import { API_BASE_URL } from "@/lib/apiClient";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

const PING_MS = 12_000;
const DISCONNECT_GRACE_MS = 2500;

/**
 * App-shell offline chrome for signed-in, onboarded users.
 * Uses socket status plus a light /health ping so Discover/Profile also show connectivity.
 */
export function OfflineBanner() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const meQuery = useCurrentUser(isSignedIn);
  const { status, isConnected } = useSocketContext();
  const [apiReachable, setApiReachable] = useState(true);
  const [showDisconnected, setShowDisconnected] = useState(false);

  const active = isSignedIn && meQuery.data?.onboardingCompleted === true;

  useEffect(() => {
    if (!active) {
      setApiReachable(true);
      return;
    }

    let cancelled = false;
    const ping = async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(`${API_BASE_URL}/health`, {
          method: "GET",
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!cancelled) {
          setApiReachable(response.ok);
        }
      } catch {
        if (!cancelled) {
          setApiReachable(false);
        }
      }
    };

    void ping();
    const interval = setInterval(() => void ping(), PING_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [active]);

  useEffect(() => {
    if (!active) {
      setShowDisconnected(false);
      return;
    }
    if (isConnected && apiReachable) {
      setShowDisconnected(false);
      return;
    }
    const timer = setTimeout(() => setShowDisconnected(true), DISCONNECT_GRACE_MS);
    return () => clearTimeout(timer);
  }, [active, apiReachable, isConnected]);

  if (!active || !showDisconnected) {
    return null;
  }

  const label = !apiReachable
    ? "You're offline — check your connection"
    : status === "connecting"
      ? "Reconnecting…"
      : "Live chat is reconnecting…";

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { top: Math.max(insets.top, 8) }]}
      accessibilityLiveRegion="polite"
    >
      <Pressable
        style={[styles.bar, { backgroundColor: colors.rose }]}
        accessibilityRole="text"
        accessibilityLabel={label}
      >
        <Text style={styles.text}>{label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    zIndex: 50,
  },
  bar: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  text: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
    textAlign: "center",
  },
});
