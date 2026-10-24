import { Image } from "expo-image";
import { useMemo, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, Text, View } from "react-native";

import { useColors, useThemeScheme } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";

import { tileLayout } from "../model/mapTiles";

const MAP_HEIGHT = 150;
const TILE_HEADERS = { "User-Agent": "Sayly/1.0 (language exchange app)" };

type ProfileMapProps = {
  latitude: number;
  longitude: number;
  /** ~10 shows a city, ~5 a country. */
  zoom: number;
};

/** Decorative city-level map header built from OpenStreetMap tiles; no pin, no interaction. */
export function ProfileMap({ latitude, longitude, zoom }: ProfileMapProps) {
  const colors = useColors();
  const dark = useThemeScheme() === "dark";
  const [width, setWidth] = useState(0);

  const tiles = useMemo(
    () => (width > 0 ? tileLayout({ latitude, longitude, zoom, width, height: MAP_HEIGHT }) : []),
    [latitude, longitude, zoom, width],
  );

  return (
    <View
      style={[styles.map, { backgroundColor: colors.card }]}
      onLayout={(event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width))}
      accessible
      accessibilityLabel="Map of where this person lives"
    >
      {tiles.map((tile) => (
        <Image
          key={tile.key}
          source={{ uri: tile.url, headers: TILE_HEADERS }}
          style={[styles.tile, { left: tile.left, top: tile.top }]}
          cachePolicy="memory-disk"
        />
      ))}
      {dark ? <View style={styles.dim} pointerEvents="none" /> : null}
      <Text style={styles.credit}>© OpenStreetMap contributors</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { height: MAP_HEIGHT, borderRadius: radius.lg, overflow: "hidden" },
  tile: { position: "absolute", width: 256, height: 256 },
  dim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  credit: {
    position: "absolute",
    right: 6,
    bottom: 4,
    fontSize: 10,
    color: "rgba(255,255,255,0.8)",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 2,
  },
});
