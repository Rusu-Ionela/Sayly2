import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { StyleSheet, Text } from "react-native";

import { PressableScale } from "@/shared/components/PressableScale";
import type { IconName } from "@/shared/components/SettingRow";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";

type QuickActionProps = {
  icon: IconName;
  label: string;
  onPress: () => void;
  /** The main action is filled; the others are outlined. */
  primary?: boolean;
};

/** Compact action button for the profile header (Edit profile, Preview…). */
export const QuickAction = memo(function QuickAction({
  icon,
  label,
  onPress,
  primary,
}: QuickActionProps) {
  const colors = useColors();
  const foreground = primary ? colors.onPrimary : colors.accent;

  return (
    <PressableScale
      onPress={onPress}
      style={[
        styles.button,
        primary
          ? { backgroundColor: colors.accent, borderColor: colors.accent }
          : { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={16} color={foreground} />
      <Text style={[styles.label, { color: foreground }]}>{label}</Text>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
  },
});
