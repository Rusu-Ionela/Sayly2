import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { IconName } from "@/shared/components/SettingRow";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

/** Icon, heading and one short paragraph at the top of every help screen. */
export const SupportIntro = memo(function SupportIntro({
  icon,
  heading,
  body,
}: {
  icon: IconName;
  heading: string;
  body: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.wrap}>
      <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
        <Ionicons name={icon} size={28} color={colors.accent} />
      </View>
      <Text style={[styles.heading, { color: colors.text }]} accessibilityRole="header">
        {heading}
      </Text>
      <Text style={[styles.body, { color: colors.muted }]}>{body}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  icon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  heading: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
});
