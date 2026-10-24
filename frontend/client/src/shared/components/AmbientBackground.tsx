import { StyleSheet, View } from "react-native";

import { useColors } from "@/shared/theme";

export function AmbientBackground() {
  const colors = useColors();

  return (
    <View
      pointerEvents="none"
      style={[styles.root, { backgroundColor: colors.background }]}
      accessibilityElementsHidden
    />
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 0,
  },
});
