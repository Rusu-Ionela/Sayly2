import type { LeaderboardEntryDto } from "@sayly/shared";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/shared/components/Avatar";
import { PressableScale } from "@/shared/components/PressableScale";
import { ProBadge } from "@/shared/components/ProBadge";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

import { daysLabel } from "../model";

type LeaderboardRowProps = {
  entry: LeaderboardEntryDto;
  onPress: () => void;
};

/** Rank, round avatar, name and 🔥 streak; your own row is highlighted. */
export const LeaderboardRow = memo(function LeaderboardRow({
  entry,
  onPress,
}: LeaderboardRowProps) {
  const colors = useColors();

  return (
    <PressableScale
      onPress={onPress}
      style={[styles.row, entry.isMe && { backgroundColor: colors.accentSoft }]}
      accessibilityRole="button"
      accessibilityLabel={`Place ${entry.rank}: ${entry.isMe ? "you" : entry.displayName}, ${daysLabel(entry.currentStreak)} streak`}
    >
      <Text style={[styles.rank, { color: colors.muted }]}>{entry.rank}</Text>
      <Avatar uri={entry.avatarUrl ?? undefined} name={entry.displayName} size={44} />
      <View style={styles.nameWrap}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {entry.isMe ? `${entry.displayName} (you)` : entry.displayName}
        </Text>
        {entry.isPro ? <ProBadge /> : null}
      </View>
      <Text style={[styles.streak, { color: colors.text }, !entry.activeToday && styles.pending]}>
        🔥 {entry.currentStreak}
      </Text>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  rank: {
    width: 26,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  nameWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  name: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "700",
  },
  streak: {
    fontSize: 16,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  pending: {
    opacity: 0.6,
  },
});
