import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

type PulseHaloProps = {
  size: number;
  color: string;
  /** Off: a still, faint ring. */
  active?: boolean;
  delayMs?: number;
};

/** An expanding, fading ring behind an avatar: "this person is live". */
export function PulseHalo({ size, color, active = true, delayMs = 0 }: PulseHaloProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const animate = active && !reduceMotion;

  useEffect(() => {
    if (!animate) {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }
    progress.value = withDelay(
      delayMs,
      withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false),
    );
    return () => cancelAnimation(progress);
  }, [animate, delayMs, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: animate ? 0.55 * (1 - progress.value) : active ? 0.35 : 0,
    transform: [{ scale: 1 + progress.value * 0.7 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.halo,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
          backgroundColor: `${color}22`,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  halo: {
    position: "absolute",
    borderWidth: 2,
  },
});
