import { Pressable, StyleSheet, Text } from "react-native";

import { useAuthCopyColors } from "./useAuthCopyColors";

type AuthCloseButtonProps = {
  onPress: () => void;
};

export function AuthCloseButton({ onPress }: AuthCloseButtonProps) {
  const copy = useAuthCopyColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close"
      hitSlop={12}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={[styles.glyph, { color: copy.close }]}>✕</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  pressed: {
    opacity: 0.7,
  },
  glyph: {
    fontSize: 22,
    fontWeight: "500",
    lineHeight: 26,
  },
});
