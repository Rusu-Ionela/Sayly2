import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { radius } from "@/shared/theme/radius";

type WelcomeActionButtonProps = {
  label: string;
  onPress: () => void;
};

/** Equal-width purple CTA used on the welcome footer row. */
export function WelcomeActionButton({ label, onPress }: WelcomeActionButtonProps) {
  return (
    <View style={styles.slot}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
      >
        <LinearGradient
          colors={["#6366F1", "#4F46E5", "#4338CA"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fill}
        >
          <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            {label}
          </Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  pressable: {
    flex: 1,
    borderRadius: radius.pill,
    overflow: "hidden",
    minHeight: 52,
  },
  fill: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  label: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.1,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.88,
  },
});
