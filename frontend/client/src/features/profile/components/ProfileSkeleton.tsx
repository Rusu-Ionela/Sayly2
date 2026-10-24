import { StyleSheet, View } from "react-native";

import { Skeleton } from "@/shared/components/Skeleton";
import { spacing } from "@/shared/theme/spacing";

/** Skeleton matched to the Profile screen: header card, stat tiles, sections. */
export function ProfileSkeleton() {
  return (
    <View style={styles.wrap} accessibilityLabel="Loading profile">
      <View style={styles.bar}>
        <Skeleton height={28} width="35%" />
        <Skeleton height={40} width={40} radius={20} />
      </View>

      <View style={styles.header}>
        <Skeleton height={96} width={96} radius={48} />
        <Skeleton height={24} width="50%" />
        <Skeleton height={16} width="35%" />
        <View style={styles.row}>
          <Skeleton height={44} width="48%" radius={16} />
          <Skeleton height={44} width="48%" radius={16} />
        </View>
      </View>

      <View style={styles.row}>
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} height={84} width="31%" radius={16} />
        ))}
      </View>

      <Skeleton height={16} width="25%" />
      <Skeleton height={120} radius={22} />
      <Skeleton height={16} width="25%" />
      <Skeleton height={112} radius={22} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  header: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignSelf: "stretch",
  },
});
