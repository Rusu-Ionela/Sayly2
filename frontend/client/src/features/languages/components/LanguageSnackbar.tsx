import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

type LanguageSnackbarProps = {
  message: string | null;
  tone?: "error" | "success";
  onDismiss: () => void;
};

export function LanguageSnackbar({ message, tone = "error", onDismiss }: LanguageSnackbarProps) {
  const colors = useColors();

  useEffect(() => {
    if (!message) {
      return;
    }
    const timeout = setTimeout(onDismiss, 4200);
    return () => clearTimeout(timeout);
  }, [message, onDismiss]);

  if (!message) {
    return null;
  }

  return (
    <View
      style={[
        styles.bar,
        tone === "success"
          ? {
              backgroundColor: `${colors.muted}33`,
              borderColor: colors.muted,
            }
          : {
              backgroundColor: `${colors.rose}44`,
              borderColor: colors.rose,
            },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Text style={[styles.text, { color: colors.text }]}>{message}</Text>
      <Pressable
        onPress={onDismiss}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      >
        <Text style={[styles.dismiss, { color: colors.text }]}>OK</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginTop: spacing.sm,
    borderWidth: 1,
  },
  text: {
    flex: 1,
    fontWeight: "700",
    fontSize: 13,
  },
  dismiss: {
    fontWeight: "800",
  },
});
