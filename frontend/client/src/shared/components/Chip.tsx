import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  /** "soft" is a static tag (no press); "filter" toggles. */
  tone?: "filter" | "soft";
  accessibilityLabel?: string;
};

/** Filter toggle or static tag — one primitive so pills look the same everywhere. */
export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  tone = "filter",
  accessibilityLabel,
}: ChipProps) {
  const colors = useColors();
  const active = tone === "filter" && selected;
  const background = active ? colors.accent : tone === "soft" ? colors.accentSoft : colors.card;
  const foreground = active ? colors.onPrimary : tone === "soft" ? colors.accent : colors.text;

  const content = (
    <>
      {icon ? <Ionicons name={icon} size={14} color={foreground} /> : null}
      <Text style={[styles.label, { color: foreground }]} numberOfLines={1}>
        {label}
      </Text>
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.chip, styles.row, { backgroundColor: background }]}>{content}</View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        styles.row,
        {
          backgroundColor: background,
          borderColor: active ? colors.accent : colors.cardBorder,
          opacity: pressed ? 0.85 : 1,
        },
        styles.bordered,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minHeight: 34,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bordered: {
    borderWidth: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
});
