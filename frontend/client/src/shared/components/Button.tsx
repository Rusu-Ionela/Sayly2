import { ActivityIndicator, Pressable, type PressableProps, Text, StyleSheet } from "react-native";

import { useColors } from "@/shared/theme";

type ButtonProps = PressableProps & {
  label: string;
  /** Shows a spinner and blocks presses while a request runs. */
  loading?: boolean;
  /** "danger": outlined in red, for sign out and other destructive actions. */
  tone?: "primary" | "danger";
};

export function Button({
  label,
  disabled,
  loading = false,
  tone = "primary",
  ...props
}: ButtonProps) {
  const colors = useColors();
  const inactive = Boolean(disabled) && !loading;
  const danger = tone === "danger";
  const textColor = inactive ? colors.muted : danger ? colors.rose : colors.onPrimary;

  return (
    <Pressable
      {...props}
      style={({ pressed }) => [
        styles.button,
        danger
          ? [styles.outlined, { borderColor: colors.rose }]
          : { backgroundColor: inactive ? colors.trail : colors.accent },
        pressed && !inactive && styles.pressed,
      ]}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={danger ? colors.rose : colors.onPrimary} />
      ) : (
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 16,
    minHeight: 54,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  outlined: {
    borderWidth: 1.5,
    backgroundColor: "transparent",
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.2,
  },
});
