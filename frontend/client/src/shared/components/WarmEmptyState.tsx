import { type ReactNode } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";
import { getTypography } from "@/shared/theme/typography";

export function WarmEmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  const colors = useColors();
  const type = getTypography(colors);

  return (
    <Animated.View entering={FadeIn.duration(280)} style={styles.wrap} accessibilityRole="text">
      <Text style={[type.cardTitle, styles.title, { color: colors.text }]}>{title}</Text>
      {body ? <Text style={[type.body, styles.body, { color: colors.muted }]}>{body}</Text> : null}
      {action}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  title: {
    textAlign: "center",
  },
  body: {
    textAlign: "center",
    maxWidth: 320,
  },
});
