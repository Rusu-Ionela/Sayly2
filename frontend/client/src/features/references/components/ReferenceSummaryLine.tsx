import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import type { ReferenceSummary } from "@/features/profile/types";
import { useColors } from "@/shared/theme";

import { describeReferences } from "../model/referenceSummary";

/** One line under a profile's header: "★ 12 references · 11 positive" or "No references yet". */
export function ReferenceSummaryLine({ summary }: { summary: ReferenceSummary | undefined }) {
  const colors = useColors();
  const hasAny = Boolean(summary?.total);

  return (
    <View style={styles.row} accessible accessibilityLabel={describeReferences(summary)}>
      <Ionicons
        name={hasAny ? "star" : "star-outline"}
        size={15}
        color={hasAny ? colors.pro : colors.muted}
      />
      <Text style={[styles.text, { color: hasAny ? colors.text : colors.muted }]}>
        {describeReferences(summary)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
  },
});
