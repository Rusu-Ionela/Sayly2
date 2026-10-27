import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";

import { remoteImageSource } from "@/lib/mediaUrl";
import { useColors } from "@/shared/theme";

type AvatarProps = {
  uri?: string | null;
  size?: number;
  /** Used for initials fallback when uri is missing */
  name?: string;
  /** Rounded-square tile (Tandem list rows) instead of a circle. */
  square?: boolean;
};

function initialsFromName(name?: string) {
  if (!name?.trim()) {
    return "?";
  }
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

export function Avatar({ uri, size = 40, name, square }: AvatarProps) {
  const colors = useColors();
  const source = remoteImageSource(uri);
  const resolved = source?.uri;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [resolved]);

  const ring = {
    width: size,
    height: size,
    borderRadius: square ? 8 : size / 2,
    borderWidth: square ? 0 : 2,
    borderColor: colors.card,
  };

  if (resolved && !failed) {
    return (
      <Image
        source={source}
        accessibilityLabel={name ? `Photo of ${name}` : "Profile photo"}
        style={ring}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={120}
        recyclingKey={source?.cacheKey ?? resolved}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View
      style={[styles.fallback, ring, { backgroundColor: colors.accentSoft }]}
      accessibilityLabel={name ? `Avatar for ${name}` : "Profile avatar"}
    >
      <Text
        style={[styles.initials, { fontSize: Math.max(14, size * 0.32), color: colors.accent }]}
      >
        {initialsFromName(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontWeight: "700",
  },
});
