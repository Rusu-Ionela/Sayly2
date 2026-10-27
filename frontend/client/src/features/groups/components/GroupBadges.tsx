import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/shared/theme";

/** Round club avatar: the club language's flag on a soft accent disc. */
export function GroupAvatar({ flag, size }: { flag: string; size: number }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.accentSoft,
          borderColor: colors.cardBorder,
        },
      ]}
    >
      <Text style={{ fontSize: Math.round(size * 0.5) }}>{flag || "🌐"}</Text>
    </View>
  );
}

const LIVE_RED = "#EF4444";

/** Small red "LIVE" pill for clubs with activity in the last few minutes. */
export function LiveBadge() {
  return (
    <View style={styles.live} accessibilityLabel="Active now">
      <View style={styles.liveDot} />
      <Text style={styles.liveText}>LIVE</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center", borderWidth: 1 },
  live: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: LIVE_RED,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#FFFFFF" },
  liveText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },
});
