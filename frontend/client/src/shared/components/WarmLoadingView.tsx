import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { useColors } from "@/shared/theme";

type WarmLoadingViewProps = {
  status?: string;
  accessibilityLabel?: string;
};

export function WarmLoadingView({
  status = "Finding conversation partners...",
  accessibilityLabel = "Loading",
}: WarmLoadingViewProps) {
  const colors = useColors();

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(220)}
      style={[styles.wrap, { backgroundColor: colors.background }]}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.status, { color: colors.muted }]}>{status}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  status: {
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
  },
});
