import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Alert, StyleSheet, Text } from "react-native";

import type { AppStackParamList } from "@/navigation/types";
import { PressableScale } from "@/shared/components/PressableScale";
import { useColors } from "@/shared/theme";

import { previewStreakCelebration, useStreak } from "./hooks";
import { streakLabel } from "./model";

/**
 * 🔥 and the number of days in a row; dimmed until today counts. Tap for the details.
 * Always shown: while loading or when the streak cannot be loaded it reads "–", so the
 * badge never silently disappears from the header.
 */
export function StreakBadge() {
  const colors = useColors();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { data: streak, isError, refetch } = useStreak();

  const showDetails = () => {
    if (!streak) {
      Alert.alert(
        "🔥 Streak",
        isError
          ? "Your streak could not be loaded right now. Please try again in a moment."
          : "Loading your streak…",
      );
      if (isError) void refetch();
      return;
    }
    Alert.alert(
      `🔥 ${streak.current} ${streak.current === 1 ? "day" : "days"}`,
      [
        streak.activeToday
          ? "Today counts. Come back tomorrow to keep it going."
          : "Open a chat, send a message or answer today's icebreaker to keep your streak.",
        `Longest streak: ${streak.longest} ${streak.longest === 1 ? "day" : "days"}.`,
      ].join("\n\n"),
      [
        { text: "OK", style: "cancel" },
        { text: "Leaderboard", onPress: () => navigation.navigate("FriendsLeaderboard") },
      ],
    );
  };

  return (
    <PressableScale
      onPress={showDetails}
      // Dev builds: long-press to preview the streak celebration.
      onLongPress={__DEV__ ? previewStreakCelebration : undefined}
      hitSlop={8}
      style={[
        styles.badge,
        { backgroundColor: colors.card, borderColor: colors.cardBorder },
        (!streak || !streak.activeToday) && styles.pending,
      ]}
      accessibilityRole="button"
      accessibilityLabel={streak ? streakLabel(streak) : "Streak not available"}
    >
      <Text style={styles.fire}>🔥</Text>
      <Text style={[styles.count, { color: colors.text }]}>{streak ? streak.current : "–"}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pending: {
    opacity: 0.6,
  },
  fire: {
    fontSize: 16,
  },
  count: {
    fontSize: 15,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
});
