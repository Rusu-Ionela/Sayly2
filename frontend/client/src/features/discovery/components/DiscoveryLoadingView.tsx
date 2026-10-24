import { StyleSheet, View } from "react-native";

import { Skeleton } from "@/shared/components/Skeleton";
import { useColors } from "@/shared/theme";

/** Mirrors UserDiscoveryCard rows so the list doesn't jump when data arrives. */
export function DiscoveryLoadingView({ rows = 7 }: { rows?: number }) {
  const colors = useColors();

  return (
    <View accessibilityLabel="Loading partners" accessibilityRole="progressbar">
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={[styles.row, { borderBottomColor: colors.border }]}>
          <Skeleton width={72} height={72} />
          <View style={styles.body}>
            <Skeleton width="40%" height={14} />
            <Skeleton width="85%" height={12} />
            <Skeleton width="55%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: { flex: 1, gap: 10, justifyContent: "center" },
});
