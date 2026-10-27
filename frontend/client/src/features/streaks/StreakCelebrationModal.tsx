import * as Haptics from "expo-haptics";
import { memo, useEffect } from "react";
import { Modal, Platform, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { MosaicBackdrop } from "@/features/splash/SplashBackdrop";
import { Button } from "@/shared/components/Button";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

import { celebrationCopy, type StreakCelebration } from "./model";

/** When the count rolls over, after the flame has landed. */
const ROLL_DELAY_MS = 650;
const NUMBER_HEIGHT = 72;
const SPARK_COUNT = 10;
const SPARK_COLORS = ["#FF9F1C", "#FFBF47", "#FF6B35", "#4C35F5"] as const;

const popSpring = { damping: 9, stiffness: 180, mass: 0.8 };

/** One ember flying out from the flame, then fading. Transform and opacity only. */
const Spark = memo(function Spark({
  index,
  progress,
}: {
  index: number;
  progress: SharedValue<number>;
}) {
  const angle = (index / SPARK_COUNT) * Math.PI * 2 + (index % 2 ? 0.2 : -0.1);
  const distance = 74 + (index % 3) * 16;
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p === 0 ? 0 : 1 - p,
      transform: [
        { translateX: Math.cos(angle) * distance * p },
        { translateY: Math.sin(angle) * distance * p },
        { scale: 1 - p * 0.6 },
      ],
    };
  });
  return (
    <Animated.View
      style={[styles.spark, { backgroundColor: SPARK_COLORS[index % SPARK_COLORS.length] }, style]}
    />
  );
});

/** The count rolls: the old number slides up and away, the new one pops in from below. */
function RollingCount({
  from,
  to,
  reduceMotion,
}: {
  from: number;
  to: number;
  reduceMotion: boolean;
}) {
  const colors = useColors();
  const roll = useSharedValue(reduceMotion ? 1 : 0);
  const pop = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    roll.value = withDelay(
      ROLL_DELAY_MS,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
    );
    pop.value = withDelay(
      ROLL_DELAY_MS + 260,
      withSequence(withTiming(1.25, { duration: 140 }), withSpring(1, popSpring)),
    );
    return () => {
      cancelAnimation(roll);
      cancelAnimation(pop);
    };
  }, [reduceMotion, roll, pop]);

  const oldStyle = useAnimatedStyle(() => ({
    opacity: 1 - roll.value,
    transform: [{ translateY: -NUMBER_HEIGHT * roll.value }],
  }));
  const newStyle = useAnimatedStyle(() => ({
    opacity: roll.value,
    transform: [{ translateY: NUMBER_HEIGHT * (1 - roll.value) }, { scale: pop.value }],
  }));

  return (
    <View style={styles.countWindow}>
      {from !== to ? (
        <Animated.Text style={[styles.count, { color: colors.muted }, oldStyle]}>
          {from}
        </Animated.Text>
      ) : null}
      <Animated.Text style={[styles.count, { color: colors.text }, newStyle]}>{to}</Animated.Text>
    </View>
  );
}

function CelebrationCard({
  celebration,
  onClose,
}: {
  celebration: StreakCelebration;
  onClose: () => void;
}) {
  const colors = useColors();
  const reduceMotion = useReducedMotion();
  const copy = celebrationCopy(celebration);

  const cardIn = useSharedValue(reduceMotion ? 1 : 0);
  const flameIn = useSharedValue(reduceMotion ? 1 : 0);
  const pulse = useSharedValue(1);
  const glow = useSharedValue(0.35);
  const sparks = useSharedValue(0);

  useEffect(() => {
    if (Platform.OS !== "web") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
    }
    if (reduceMotion) return;

    cardIn.value = withSpring(1, { damping: 16, stiffness: 160 });
    // Bounce in: overshoot, settle, then keep breathing.
    flameIn.value = withDelay(
      120,
      withSequence(
        withTiming(1.3, { duration: 260, easing: Easing.out(Easing.back(2)) }),
        withSpring(1, popSpring),
      ),
    );
    pulse.value = withDelay(
      900,
      withRepeat(
        withSequence(
          withTiming(1.09, { duration: 650, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 650, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
    glow.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.3, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
    sparks.value = withDelay(
      260,
      withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }),
    );

    return () => {
      [cardIn, flameIn, pulse, glow, sparks].forEach((value) => cancelAnimation(value));
    };
  }, [reduceMotion, cardIn, flameIn, pulse, glow, sparks]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: Math.min(cardIn.value * 1.4, 1),
    transform: [{ translateY: 28 * (1 - cardIn.value) }, { scale: 0.9 + 0.1 * cardIn.value }],
  }));
  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: flameIn.value * pulse.value }, { rotate: `${(pulse.value - 1) * 40}deg` }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 0.85 + glow.value * 0.4 }],
  }));

  const dayWord = celebration.to === 1 ? "day" : "days";

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          shadowColor: colors.primary,
        },
        cardStyle,
      ]}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`${copy.title} ${celebration.to} ${dayWord} in a row. ${copy.body}`}
    >
      <View style={styles.flameStage} importantForAccessibility="no-hide-descendants">
        <Animated.View style={[styles.glow, { backgroundColor: colors.accentSoft }, glowStyle]} />
        {Array.from({ length: SPARK_COUNT }, (_, index) => (
          <Spark key={index} index={index} progress={sparks} />
        ))}
        <Animated.Text style={[styles.flame, flameStyle]}>🔥</Animated.Text>
      </View>

      <RollingCount from={celebration.from} to={celebration.to} reduceMotion={reduceMotion} />
      <Text style={[styles.unit, { color: colors.accent }]}>{dayWord} in a row</Text>

      <Text style={[styles.title, { color: colors.text }]}>{copy.title}</Text>
      <Text style={[styles.body, { color: colors.muted }]}>{copy.body}</Text>

      {celebration.isBest ? null : (
        <View style={[styles.best, { backgroundColor: colors.surface }]}>
          <Text style={[styles.bestText, { color: colors.label }]}>
            Longest streak: {celebration.longest} {celebration.longest === 1 ? "day" : "days"}
          </Text>
        </View>
      )}

      <View style={styles.action}>
        <Button label="Keep going" onPress={onClose} />
      </View>
    </Animated.View>
  );
}

/**
 * Full-screen celebration when today starts counting toward the streak. Sits on the same
 * mosaic as the welcome and sign-in screens. All motion runs on the UI thread (Reanimated
 * transforms and opacity), and it stays still when the device asks for reduced motion.
 */
export function StreakCelebrationModal({
  celebration,
  onClose,
}: {
  celebration: StreakCelebration | null;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={celebration !== null}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <MosaicBackdrop focusHalo={false} />
        <SafeAreaView style={styles.center}>
          {celebration ? <CelebrationCard celebration={celebration} onClose={onClose} /> : null}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  card: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 12,
  },
  flameStage: {
    width: 160,
    height: 150,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  spark: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  flame: { fontSize: 84, lineHeight: 100 },
  countWindow: {
    height: NUMBER_HEIGHT,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  count: {
    position: "absolute",
    fontSize: 60,
    lineHeight: NUMBER_HEIGHT,
    fontWeight: "800",
    letterSpacing: -1.5,
    fontVariant: ["tabular-nums"],
  },
  unit: {
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    marginTop: spacing.md,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.4,
    textAlign: "center",
  },
  body: {
    marginTop: spacing.xs,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
    textAlign: "center",
  },
  best: {
    marginTop: spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  bestText: { fontSize: 13, fontWeight: "700" },
  action: { alignSelf: "stretch", marginTop: spacing.lg },
});
