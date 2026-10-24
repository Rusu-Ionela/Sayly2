import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useThemeScheme } from "@/shared/theme/ThemeProvider";
import type { ThemeScheme } from "@/shared/theme/colors";

const CELL = 140;
const GAP = 12;
const RADIUS = 22;

const LIGHT = {
  wash: ["#F8F9FE", "#E8EBFD", "#F8F9FE"] as const,
  solids: [
    "#FFFFFF",
    "#F5F3FF",
    "#EEEBFF",
    "#E8E4FF",
    "#F0EEFF",
    "#EDEAFF",
    "#F8F7FF",
    "#E4DFFF",
    "#F4F2FF",
  ] as const,
  diagonals: [
    ["#E8E4FF", "#F5F3FF"],
    ["#DDD8F5", "#EEEBFF"],
    ["#EDEAFF", "#D8D3FF"],
    ["#F0EEFF", "#E8E4FF"],
  ] as const,
  orbs: ["rgba(61, 49, 251, 0.12)", "rgba(40, 26, 206, 0.10)", "rgba(61, 49, 251, 0.08)"] as const,
  specks: [
    { x: 0.12, y: 0.18, size: 7, color: "rgba(61,49,251,0.22)" },
    { x: 0.84, y: 0.14, size: 5, color: "rgba(40,26,206,0.20)" },
    { x: 0.18, y: 0.78, size: 6, color: "rgba(61,49,251,0.16)" },
    { x: 0.9, y: 0.72, size: 8, color: "rgba(40,26,206,0.14)" },
    { x: 0.08, y: 0.46, size: 4, color: "rgba(61,49,251,0.18)" },
    { x: 0.76, y: 0.38, size: 5, color: "rgba(107,97,245,0.22)" },
    { x: 0.42, y: 0.1, size: 4, color: "rgba(61,49,251,0.14)" },
    { x: 0.58, y: 0.88, size: 6, color: "rgba(40,26,206,0.16)" },
  ] as const,
  overlay: [
    "rgba(245,243,255,0.22)",
    "rgba(245,243,255,0.08)",
    "rgba(255,255,255,0.72)",
    "rgba(245,243,255,0.55)",
  ] as const,
  focus: "rgba(255,255,255,0.42)",
  tileBorder: "rgba(255,255,255,0.72)",
  root: "#F8F9FE",
};

/** Night craft in logo indigo — low contrast, no teal, no slate gray. */
const DARK = {
  wash: ["#0F172A", "#1E293B", "#0F172A"] as const,
  solids: [
    "#16142E",
    "#1A1736",
    "#1E1B3C",
    "#221E46",
    "#262350",
    "#1C1838",
    "#281ACE",
    "#241F4E",
    "#14122A",
    "#312A6A",
  ] as const,
  diagonals: [
    ["#281ACE", "#16142E"],
    ["#3D31FB", "#1A1736"],
    ["#1E1B3C", "#281ACE"],
    ["#241F4E", "#3D31FB"],
  ] as const,
  orbs: ["rgba(61, 49, 251, 0.22)", "rgba(40, 26, 206, 0.16)", "rgba(107, 97, 245, 0.14)"] as const,
  specks: [
    { x: 0.12, y: 0.18, size: 7, color: "rgba(107,97,245,0.28)" },
    { x: 0.84, y: 0.14, size: 5, color: "rgba(61,49,251,0.24)" },
    { x: 0.18, y: 0.78, size: 6, color: "rgba(155,148,255,0.22)" },
    { x: 0.9, y: 0.72, size: 8, color: "rgba(40,26,206,0.22)" },
    { x: 0.08, y: 0.46, size: 4, color: "rgba(107,97,245,0.2)" },
    { x: 0.76, y: 0.38, size: 5, color: "rgba(61,49,251,0.22)" },
    { x: 0.42, y: 0.1, size: 4, color: "rgba(155,148,255,0.16)" },
    { x: 0.58, y: 0.88, size: 6, color: "rgba(40,26,206,0.18)" },
  ] as const,
  overlay: [
    "rgba(12,10,28,0.28)",
    "rgba(12,10,28,0.08)",
    "rgba(18,16,40,0.38)",
    "rgba(12,10,28,0.5)",
  ] as const,
  focus: "rgba(22, 20, 46, 0.38)",
  tileBorder: "rgba(155,148,255,0.08)",
  root: "#0F172A",
};

function palette(scheme: ThemeScheme) {
  return scheme === "dark" ? DARK : LIGHT;
}

type MosaicTile = {
  key: string;
  left: number;
  top: number;
  width: number;
  height: number;
  color: string;
  colors?: readonly [string, string];
};

function FloatingOrb({
  size,
  color,
  start,
  end,
  duration,
}: {
  size: number;
  color: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  duration: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [duration, progress]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [start.x, end.x],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [start.y, end.y],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.orb,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          transform: [{ translateX }, { translateY }],
        },
      ]}
    />
  );
}

type MosaicBackdropProps = {
  /** Splash keeps a soft halo behind the logo; auth uses a lighter veil. */
  focusHalo?: boolean;
};

export function MosaicBackdrop({ focusHalo = true }: MosaicBackdropProps) {
  const scheme = useThemeScheme();
  const theme = palette(scheme);
  const { width, height } = useWindowDimensions();

  const tiles = useMemo(() => {
    const cols = Math.ceil(width / CELL) + 1;
    const rows = Math.ceil(height / CELL) + 2;
    const occupied = new Set<string>();
    const list: MosaicTile[] = [];

    const mark = (row: number, col: number) => occupied.add(`${row}:${col}`);
    const taken = (row: number, col: number) => occupied.has(`${row}:${col}`);

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (taken(row, col)) continue;

        const seed = row * 31 + col * 17;
        let spanW = 1;
        let spanH = 1;

        if (seed % 13 === 0 && col < cols - 1 && !taken(row, col + 1)) {
          spanW = 2;
        } else if (seed % 17 === 0 && row < rows - 1 && !taken(row + 1, col)) {
          spanH = 2;
        }

        for (let r = 0; r < spanH; r += 1) {
          for (let c = 0; c < spanW; c += 1) {
            mark(row + r, col + c);
          }
        }

        const useDiagonal = seed % 7 === 0 || (spanW + spanH > 2 && seed % 5 === 0);
        const left = col * CELL + GAP / 2;
        const top = row * CELL + GAP / 2;
        const tileWidth = spanW * CELL - GAP;
        const tileHeight = spanH * CELL - GAP;

        if (useDiagonal) {
          const pair = theme.diagonals[Math.abs(seed) % theme.diagonals.length]!;
          list.push({
            key: `${row}-${col}`,
            left,
            top,
            width: tileWidth,
            height: tileHeight,
            color: pair[0],
            colors: [pair[0], pair[1]],
          });
        } else {
          list.push({
            key: `${row}-${col}`,
            left,
            top,
            width: tileWidth,
            height: tileHeight,
            color:
              theme.solids[Math.abs(seed + ((row + col) % 2 === 0 ? 0 : 3)) % theme.solids.length]!,
          });
        }
      }
    }

    return list;
  }, [height, theme, width]);

  return (
    <View
      pointerEvents="none"
      style={[styles.root, { backgroundColor: theme.root }]}
      accessibilityElementsHidden
    >
      <LinearGradient
        colors={[theme.wash[0], theme.wash[1], theme.wash[2]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {tiles.map((tile) =>
        tile.colors ? (
          <LinearGradient
            key={tile.key}
            colors={[tile.colors[0], tile.colors[1]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.tile,
              {
                left: tile.left,
                top: tile.top,
                width: tile.width,
                height: tile.height,
                borderColor: theme.tileBorder,
              },
            ]}
          />
        ) : (
          <View
            key={tile.key}
            style={[
              styles.tile,
              {
                left: tile.left,
                top: tile.top,
                width: tile.width,
                height: tile.height,
                backgroundColor: tile.color,
                borderColor: theme.tileBorder,
              },
            ]}
          />
        ),
      )}

      <FloatingOrb
        size={width * 0.78}
        color={theme.orbs[0]}
        start={{ x: -width * 0.34, y: -height * 0.1 }}
        end={{ x: -width * 0.22, y: height * 0.02 }}
        duration={5200}
      />
      <FloatingOrb
        size={width * 0.62}
        color={theme.orbs[1]}
        start={{ x: width * 0.52, y: height * 0.48 }}
        end={{ x: width * 0.4, y: height * 0.56 }}
        duration={6400}
      />
      <FloatingOrb
        size={width * 0.42}
        color={theme.orbs[2]}
        start={{ x: width * 0.18, y: height * 0.62 }}
        end={{ x: width * 0.28, y: height * 0.54 }}
        duration={7000}
      />

      {theme.specks.map((speck) => (
        <View
          key={`${speck.x}-${speck.y}`}
          style={[
            styles.speck,
            {
              left: width * speck.x,
              top: height * speck.y,
              width: speck.size,
              height: speck.size,
              borderRadius: speck.size / 2,
              backgroundColor: speck.color,
            },
          ]}
        />
      ))}

      <LinearGradient
        pointerEvents="none"
        colors={[theme.overlay[0], theme.overlay[1], theme.overlay[2], theme.overlay[3]]}
        locations={[0, 0.22, 0.52, 1]}
        style={StyleSheet.absoluteFill}
      />
      {focusHalo ? (
        <View
          style={[
            styles.focus,
            {
              backgroundColor: theme.focus,
              width: Math.min(width * 0.92, 420),
              height: Math.min(width * 0.92, 420),
              left: width / 2 - Math.min(width * 0.92, 420) / 2,
              top: height / 2 - Math.min(width * 0.92, 420) / 2 - 36,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    overflow: "hidden",
  },
  tile: {
    position: "absolute",
    borderRadius: RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
  },
  orb: {
    position: "absolute",
  },
  speck: {
    position: "absolute",
  },
  focus: {
    position: "absolute",
    borderRadius: 999,
  },
});
