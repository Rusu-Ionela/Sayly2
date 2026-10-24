import { Ionicons } from "@expo/vector-icons";
import { memo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

type PhraseCardProps = {
  phrase: string;
  /** A partner's correction or a translation. */
  corrected?: string | null;
  meaning?: string | null;
  example?: string | null;
  speaking: boolean;
  onSpeak: () => void;
  /** Top-right action (⋮ menu or bookmark). */
  action: ReactNode;
};

/** One expression: phrase, play button, meaning, example sentence and an action. */
export const PhraseCard = memo(function PhraseCard({
  phrase,
  corrected,
  meaning,
  example,
  speaking,
  onSpeak,
  action,
}: PhraseCardProps) {
  const colors = useColors();

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={styles.header}>
        <Pressable
          onPress={onSpeak}
          hitSlop={8}
          style={[styles.play, { backgroundColor: speaking ? colors.accent : colors.accentSoft }]}
          accessibilityRole="button"
          accessibilityState={{ selected: speaking }}
          accessibilityLabel={speaking ? "Stop" : `Listen to ${phrase}`}
        >
          <Ionicons
            name={speaking ? "stop" : "volume-high"}
            size={18}
            color={speaking ? colors.onPrimary : colors.accent}
          />
        </Pressable>
        <Text style={[styles.phrase, { color: colors.text }]}>{phrase}</Text>
        {action}
      </View>

      {corrected ? (
        <Text style={[styles.corrected, { color: colors.accent }]}>→ {corrected}</Text>
      ) : null}
      {meaning ? <Text style={[styles.meaning, { color: colors.label }]}>{meaning}</Text> : null}
      {example ? (
        <View style={[styles.example, { borderLeftColor: colors.accent }]}>
          <Text style={[styles.exampleText, { color: colors.muted }]}>“{example}”</Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  play: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  phrase: {
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 23,
  },
  corrected: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
  },
  meaning: {
    fontSize: 15,
    lineHeight: 21,
  },
  example: {
    borderLeftWidth: 3,
    paddingLeft: spacing.sm,
  },
  exampleText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
  },
});
