import { Ionicons } from "@expo/vector-icons";
import { memo, useState } from "react";
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

/** Question that expands to show its answer. */
export const FaqItem = memo(function FaqItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOpen((value) => !value);
        }}
        style={styles.row}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={question}
      >
        <Text style={[styles.question, { color: colors.text }]}>{question}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </Pressable>
      {open ? <Text style={[styles.answer, { color: colors.muted }]}>{answer}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  question: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  answer: {
    fontSize: 14,
    lineHeight: 21,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
});
