import { PARTY_REACTION_EMOJI } from "@sayly/shared";
import { memo, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { REACTION_LIFETIME_MS, type FloatingReaction } from "../model/partyModel";

const RISE = 260;

const Bubble = memo(function Bubble({ reaction }: { reaction: FloatingReaction }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: REACTION_LIFETIME_MS,
      easing: Easing.out(Easing.quad),
    });
  }, [progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value < 0.75 ? 1 : 1 - (progress.value - 0.75) / 0.25,
    transform: [
      { translateY: -RISE * progress.value },
      { translateX: Math.sin(progress.value * Math.PI * 3) * 12 },
      { scale: 0.6 + Math.min(progress.value * 3, 1) * 0.6 },
    ],
  }));

  return (
    <Animated.Text style={[styles.emoji, { left: `${10 + reaction.lane * 70}%` }, style]}>
      {PARTY_REACTION_EMOJI[reaction.kind]}
    </Animated.Text>
  );
});

/** Reactions rising over the room. Purely decorative, so hidden from screen readers. */
export function FloatingReactions({ reactions }: { reactions: FloatingReaction[] }) {
  return (
    <View
      pointerEvents="none"
      style={styles.layer}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {reactions.map((reaction) => (
        <Bubble key={reaction.id} reaction={reaction} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, overflow: "hidden" },
  emoji: { position: "absolute", bottom: 90, fontSize: 32 },
});
