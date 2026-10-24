import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";

import { SaylyLogo } from "@/components/SaylyLogo";
import { useColors, useThemeScheme } from "@/shared/theme";
import { getTypography } from "@/shared/theme/typography";

import { MosaicBackdrop } from "./SplashBackdrop";

const MIN_DURATION_MS = 2800;
const LOGO_SIZE = 132;

type SplashScreenProps = {
  isReady: boolean;
  onComplete: () => void;
};

function PulseRing({ delay, size, mint = false }: { delay: number; size: number; mint?: boolean }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(progress, {
          toValue: 1,
          duration: 2600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [delay, progress]);

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1.45],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.12, 0.55, 1],
    outputRange: [0, 0.5, 0.22, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        mint ? styles.ringMint : null,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

export function SplashScreen({ isReady, onComplete }: SplashScreenProps) {
  const colors = useColors();
  const scheme = useThemeScheme();
  const type = getTypography(colors);
  const mountTimeRef = useRef(Date.now());
  const hasExitedRef = useRef(false);

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.55)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoFloat = useRef(new Animated.Value(0)).current;
  const logoTilt = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0.35)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(18)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 7,
        tension: 72,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 680,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    const titleTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(titleY, {
          toValue: 0,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, 420);

    const subtitleTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(subtitleOpacity, {
          toValue: 1,
          duration: 480,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(subtitleY, {
          toValue: 0,
          duration: 480,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, 720);

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloat, {
          toValue: -10,
          duration: 1900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(logoFloat, {
          toValue: 10,
          duration: 1900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const tiltLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoTilt, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(logoTilt, {
          toValue: -1,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 0.85,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.35,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    floatLoop.start();
    tiltLoop.start();
    glowLoop.start();

    return () => {
      clearTimeout(titleTimer);
      clearTimeout(subtitleTimer);
      floatLoop.stop();
      tiltLoop.stop();
      glowLoop.stop();
    };
  }, [
    glowOpacity,
    logoFloat,
    logoOpacity,
    logoScale,
    logoTilt,
    subtitleOpacity,
    subtitleY,
    titleOpacity,
    titleY,
  ]);

  useEffect(() => {
    if (!isReady || hasExitedRef.current) return;

    const remaining = Math.max(0, MIN_DURATION_MS - (Date.now() - mountTimeRef.current));
    const exitTimer = setTimeout(() => {
      hasExitedRef.current = true;
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 480,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          onComplete();
          return;
        }
        // Interrupted fade (app backgrounded, etc.) — still leave splash.
        onComplete();
      });
    }, remaining);

    return () => clearTimeout(exitTimer);
  }, [isReady, onComplete, screenOpacity]);

  const logoRotate = logoTilt.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-3deg", "3deg"],
  });

  return (
    <Animated.View
      style={[styles.root, { opacity: screenOpacity, backgroundColor: colors.background }]}
    >
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <MosaicBackdrop />

      <View style={styles.center}>
        <View style={styles.logoStage}>
          <PulseRing delay={0} size={220} />
          <PulseRing delay={900} size={260} mint />
          <PulseRing delay={1800} size={300} />

          <Animated.View pointerEvents="none" style={[styles.glow, { opacity: glowOpacity }]}>
            <LinearGradient
              colors={["rgba(61,49,251,0.28)", "rgba(40,26,206,0.10)", "transparent"]}
              style={styles.glowGradient}
            />
          </Animated.View>

          <Animated.View
            style={{
              opacity: logoOpacity,
              transform: [{ scale: logoScale }, { translateY: logoFloat }, { rotate: logoRotate }],
            }}
          >
            <SaylyLogo width={LOGO_SIZE} height={LOGO_SIZE} accessibilityLabel="Sayly" />
          </Animated.View>
        </View>

        <Animated.Text
          style={[
            styles.title,
            type.screenTitle,
            {
              opacity: titleOpacity,
              transform: [{ translateY: titleY }],
            },
          ]}
        >
          Sayly
        </Animated.Text>

        <Animated.Text
          style={[
            styles.subtitle,
            type.screenSubtitle,
            {
              opacity: subtitleOpacity,
              transform: [{ translateY: subtitleY }],
            },
          ]}
        >
          Learn languages. Meet real people.
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  logoStage: {
    width: 300,
    height: 300,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  glow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  glowGradient: {
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  ring: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: "rgba(61,49,251,0.28)",
  },
  ringMint: {
    borderColor: "rgba(40,26,206,0.22)",
  },
  title: {
    fontSize: 34,
    marginTop: 4,
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    marginTop: 10,
    maxWidth: 280,
  },
});
