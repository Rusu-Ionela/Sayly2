import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";

/** Gold "PRO" pill — Pro members and Pro-only features. */
export const ProBadge = memo(function ProBadge({ label = "PRO" }: { label?: string }) {
  const colors = useColors();
  return (
    <View
      style={[styles.pill, { backgroundColor: colors.proSoft }]}
      accessibilityLabel={label === "PRO" ? "Pro" : label}
    >
      <Ionicons name="star" size={11} color={colors.pro} />
      <Text style={[styles.text, { color: colors.pro }]}>{label}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
});
