import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Platform, StyleSheet, Text, View } from "react-native";

import type { WelcomeSlide } from "@/features/auth/welcomeAssets";

type WelcomeHeroCarouselProps = {
  slides: readonly WelcomeSlide[];
  width: number;
  height: number;
  /** Pause on each slide before the next transition. */
  holdMs?: number;
};

const FADE_OUT_MS = 320;
const FADE_IN_MS = 480;

export function WelcomeHeroCarousel({
  slides,
  width,
  height,
  holdMs = 4800,
}: WelcomeHeroCarouselProps) {
  const [index, setIndex] = useState(0);
  const contentFade = useRef(new Animated.Value(1)).current;
  const contentY = useRef(new Animated.Value(0)).current;
  const opacities = useRef(slides.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;
  const indexRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    if (slides.length <= 1) return;

    mountedRef.current = true;

    const tick = () => {
      const prev = indexRef.current;
      const next = (prev + 1) % slides.length;

      Animated.parallel([
        Animated.timing(opacities[prev]!, {
          toValue: 0,
          duration: FADE_OUT_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(contentFade, {
          toValue: 0,
          duration: FADE_OUT_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(contentY, {
          toValue: -10,
          duration: FADE_OUT_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished || !mountedRef.current) return;

        indexRef.current = next;
        setIndex(next);
        contentY.setValue(12);
        opacities[next]!.setValue(0);

        Animated.parallel([
          Animated.timing(opacities[next]!, {
            toValue: 1,
            duration: FADE_IN_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(contentFade, {
            toValue: 1,
            duration: FADE_IN_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(contentY, {
            toValue: 0,
            duration: FADE_IN_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      });
    };

    const id = setInterval(tick, holdMs);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [contentFade, contentY, holdMs, opacities, slides.length]);

  const slide = slides[index] ?? slides[0];
  if (!slide) return null;

  return (
    <View style={styles.stage}>
      <View style={[styles.heroFrame, { width, height }]}>
        {slides.map((item, i) => (
          <Animated.View
            key={item.id}
            pointerEvents="none"
            style={[styles.heroLayer, { opacity: opacities[i] }]}
          >
            <Image
              source={item.image}
              style={styles.heroImage}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </Animated.View>
        ))}
      </View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.greetingWrap,
          {
            opacity: contentFade,
            transform: [{ translateY: contentY }],
          },
        ]}
      >
        <Text style={styles.greeting}>{slide.greeting}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    marginTop: 4,
    marginBottom: 4,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 280,
  },
  heroFrame: {
    alignSelf: "flex-start",
    marginLeft: -8,
    zIndex: 1,
  },
  heroLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  greetingWrap: {
    position: "absolute",
    right: 4,
    top: "22%",
    zIndex: 2,
    maxWidth: "55%",
    alignItems: "flex-start",
  },
  greeting: {
    color: "#FFFFFF",
    fontSize: 44,
    lineHeight: 48,
    fontWeight: "900",
    letterSpacing: -1.1,
    ...(Platform.OS === "web"
      ? { textShadow: "0px 2px 10px rgba(0,0,0,0.45)" }
      : {
          textShadowColor: "rgba(0,0,0,0.45)",
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 10,
        }),
  },
});
