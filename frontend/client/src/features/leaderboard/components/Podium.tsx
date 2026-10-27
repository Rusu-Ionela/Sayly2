import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { LeaderboardEntryDto } from "@sayly/shared";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/shared/components/Avatar";
import { PressableScale } from "@/shared/components/PressableScale";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

import { daysLabel, podiumOrder } from "../model";

/** Gold, silver and bronze, by rank (tied members share a medal). */
const MEDAL_COLORS: Record<number, string> = {
  1: "#F5B700",
  2: "#A8B3C2",
  3: "#CD7F32",
};

const STEP_HEIGHT: Record<number, number> = { 1: 96, 2: 72, 3: 56 };

type PodiumProps = {
  /** The first three entries, in rank order. */
  entries: LeaderboardEntryDto[];
  onPressMember: (entry: LeaderboardEntryDto) => void;
};

function PodiumPlace({ entry, onPress }: { entry: LeaderboardEntryDto; onPress: () => void }) {
  const colors = useColors();
  const isFirst = entry.rank === 1;
  const medal = MEDAL_COLORS[entry.rank] ?? colors.muted;
  const avatarSize = isFirst ? 76 : 60;

  return (
    <PressableScale
      onPress={onPress}
      style={styles.place}
      accessibilityRole="button"
      accessibilityLabel={`Place ${entry.rank}: ${entry.isMe ? "you" : entry.displayName}, ${daysLabel(entry.currentStreak)} streak`}
    >
      <View style={styles.crownSlot}>
        {isFirst ? <MaterialCommunityIcons name="crown" size={30} color={medal} /> : null}
      </View>
      <View>
        <View style={[styles.avatarRing, { borderColor: medal }]}>
          <Avatar uri={entry.avatarUrl ?? undefined} name={entry.displayName} size={avatarSize} />
        </View>
        <View style={[styles.medal, { backgroundColor: medal, borderColor: colors.card }]}>
          <Text style={styles.medalText}>{entry.rank}</Text>
        </View>
      </View>
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
        {entry.isMe ? "You" : entry.displayName}
      </Text>
      <Text style={[styles.streak, { color: colors.text }]}>🔥 {entry.currentStreak}</Text>
      <View
        style={[
          styles.step,
          {
            height: STEP_HEIGHT[entry.rank] ?? STEP_HEIGHT[3],
            backgroundColor: entry.isMe ? colors.accentSoft : colors.surface,
            borderColor: medal,
          },
        ]}
      />
    </PressableScale>
  );
}

/** Top three: 2nd, 1st (with a crown) and 3rd, on steps of different heights. */
export const Podium = memo(function Podium({ entries, onPressMember }: PodiumProps) {
  return (
    <View style={styles.row}>
      {podiumOrder(entries).map((entry) => (
        <PodiumPlace key={entry.userId} entry={entry} onPress={() => onPressMember(entry)} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: spacing.sm,
  },
  place: {
    flex: 1,
    maxWidth: 130,
    alignItems: "center",
    gap: 6,
  },
  crownSlot: {
    height: 30,
    justifyContent: "flex-end",
  },
  avatarRing: {
    borderWidth: 3,
    borderRadius: 999,
    padding: 2,
  },
  medal: {
    position: "absolute",
    bottom: -6,
    alignSelf: "center",
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  medalText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  name: {
    marginTop: spacing.xs,
    fontSize: 14,
    fontWeight: "700",
  },
  streak: {
    fontSize: 15,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  step: {
    alignSelf: "stretch",
    borderTopWidth: 3,
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
  },
});
