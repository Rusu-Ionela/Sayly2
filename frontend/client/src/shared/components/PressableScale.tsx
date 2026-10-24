import { type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { splitPressableStyle } from "@/shared/utils/splitPressableStyle";

type PressableScaleProps = Omit<PressableProps, "style"> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
};

export function PressableScale({
  children,
  style,
  disabled,
  scaleTo = 0.98,
  onPressIn,
  onPressOut,
  ...props
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const { shell, content } = splitPressableStyle(StyleSheet.flatten(style));

  // Avoid Animated.createAnimatedComponent(Pressable) — it throws on web.
  // Avoid nesting PressableScale inside PressableScale on web (invalid nested <button>).
  return (
    <Animated.View style={[shell, animatedStyle, disabled ? { opacity: 0.55 } : null]}>
      <Pressable
        {...props}
        disabled={disabled}
        style={[styles.hit, content]}
        onPressIn={(event) => {
          scale.value = withSpring(scaleTo, { damping: 18, stiffness: 420 });
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          scale.value = withSpring(1, { damping: 16, stiffness: 380 });
          onPressOut?.(event);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Fill the shell so centering works against its full (min)height.
  hit: {
    width: "100%",
    flexGrow: 1,
  },
});
