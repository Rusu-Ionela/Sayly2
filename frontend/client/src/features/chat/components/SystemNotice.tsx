import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/shared/theme";

/** Centered, non-interactive line for SYSTEM messages (e.g. "Ana started following you"). */
export function SystemNotice({ text }: { text: string }) {
  const colors = useColors();
  return (
    <View style={styles.row} accessibilityRole="text">
      <Text style={[styles.text, { color: colors.muted }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "center", paddingVertical: 10, paddingHorizontal: 24 },
  text: { fontSize: 13, textAlign: "center" },
});
