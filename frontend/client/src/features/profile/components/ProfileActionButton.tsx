import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/shared/components/PressableScale";
import { useColors } from "@/shared/theme";

type ProfileActionButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  busy?: boolean;
  /** Solid accent circle (default) or a quiet outlined state like "Following". */
  quiet?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
};

/** Round action under the profile photo: icon in a circle with a label beneath. */
export function ProfileActionButton({
  icon,
  label,
  onPress,
  busy,
  quiet,
  disabled,
  accessibilityLabel,
}: ProfileActionButtonProps) {
  const colors = useColors();

  return (
    <PressableScale
      onPress={onPress}
      disabled={busy || disabled}
      style={styles.action}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(busy) }}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <View style={[styles.circle, { backgroundColor: quiet ? colors.card : colors.accent }]}>
        {busy ? (
          <ActivityIndicator color={quiet ? colors.accent : colors.onPrimary} />
        ) : (
          <Ionicons name={icon} size={26} color={quiet ? colors.accent : colors.onPrimary} />
        )}
      </View>
      <Text style={[styles.label, { color: colors.accent }]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  action: { alignItems: "center", gap: 8, minWidth: 68 },
  circle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 13, fontWeight: "600" },
});
