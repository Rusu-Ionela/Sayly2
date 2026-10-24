import { StyleSheet, Text, View } from "react-native";

import { useSocketContext } from "@/features/chat/socket/SocketProvider";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

/**
 * Lightweight reconnect / offline cue for every main tab, not only Chats.
 */
export function ConnectionStatusBanner() {
  const colors = useColors();
  const { status } = useSocketContext();

  if (status !== "connecting" && status !== "error") {
    return null;
  }

  const label =
    status === "connecting" ? "Reconnecting…" : "Live updates unavailable — check your connection";

  return (
    <View
      style={[styles.banner, { backgroundColor: colors.accentSoft }]}
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      <Text style={[styles.text, { color: colors.accent }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  text: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
});
