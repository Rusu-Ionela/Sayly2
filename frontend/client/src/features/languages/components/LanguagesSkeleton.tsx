import { StyleSheet, View } from "react-native";

import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

function Bone({
  height,
  width,
  radius = 12,
  color,
}: {
  height: number;
  width?: number | `${number}%`;
  radius?: number;
  color: string;
}) {
  return (
    <View
      style={{
        height,
        width: width ?? "100%",
        borderRadius: radius,
        backgroundColor: color,
      }}
    />
  );
}

export function LanguagesSkeleton() {
  const colors = useColors();

  return (
    <View style={styles.wrap} accessibilityLabel="Loading languages">
      <Bone height={44} radius={14} color={colors.card} />
      <Bone height={88} radius={18} color={colors.card} />
      <Bone height={88} radius={18} color={colors.card} />
      <Bone height={88} radius={18} color={colors.card} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
});
