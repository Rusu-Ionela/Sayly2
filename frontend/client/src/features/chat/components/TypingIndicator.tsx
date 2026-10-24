import { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

type TypingIndicatorProps = {
  name?: string;
};

function Dot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.35);
  const colors = useColors();

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(withTiming(1, { duration: 280 }), withTiming(0.35, { duration: 280 })),
        -1,
        false,
      ),
    );
  }, [delay, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.dot, { backgroundColor: colors.muted }, style]} />;
}

function TypingIndicatorComponent({ name }: TypingIndicatorProps) {
  const colors = useColors();
  const label = name ? `${name} is typing` : "Typing";

  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite" accessibilityLabel={`${label}…`}>
      <View
        style={[styles.bubble, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
      >
        <Dot delay={0} />
        <Dot delay={140} />
        <Dot delay={280} />
      </View>
      <Text style={[styles.label, { color: colors.muted }]}>{label}…</Text>
    </View>
  );
}

export const TypingIndicator = memo(TypingIndicatorComponent);

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
  },
});
