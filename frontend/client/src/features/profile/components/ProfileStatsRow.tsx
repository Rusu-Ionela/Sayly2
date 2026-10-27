import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

export type ProfileStat = {
  key: string;
  emoji: string;
  /** null while loading or unavailable; shown as "–". */
  value: number | null;
  label: string;
};

/** Gamification tiles under the languages on your profile (streak, partners…). */
export const ProfileStatsRow = memo(function ProfileStatsRow({ stats }: { stats: ProfileStat[] }) {
  const colors = useColors();

  return (
    <View style={styles.row}>
      {stats.map((stat) => (
        <View
          key={stat.key}
          style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
          accessible
          accessibilityLabel={`${stat.label}: ${stat.value ?? "not available"}`}
        >
          <Text style={styles.emoji}>{stat.emoji}</Text>
          <Text style={[styles.value, { color: colors.text }]} numberOfLines={1}>
            {stat.value ?? "–"}
          </Text>
          <Text style={[styles.label, { color: colors.muted }]} numberOfLines={1}>
            {stat.label}
          </Text>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    alignSelf: "stretch",
    marginTop: spacing.sm,
  },
  tile: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 2,
  },
  emoji: { fontSize: 18 },
  value: { fontSize: 18, fontWeight: "800", fontVariant: ["tabular-nums"] },
  label: { fontSize: 12, fontWeight: "600" },
});
