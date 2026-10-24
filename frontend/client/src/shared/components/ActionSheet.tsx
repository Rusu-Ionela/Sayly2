import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { IconName } from "@/shared/components/SettingRow";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

type ActionSheetAction = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  /** "primary" is a filled button; "danger" is red text. */
  tone?: "default" | "primary" | "danger";
  loading?: boolean;
};

type ActionSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  /** Large icon above the title (prompts such as "Turn on your Sayly ID"). */
  icon?: IconName;
  actions: ActionSheetAction[];
  /** Label of the dismiss button; omit to hide it. */
  cancelLabel?: string;
};

/**
 * Bottom sheet for short prompts and context menus (⋮). Tapping the backdrop or the
 * cancel button closes it; actions do not close it themselves.
 */
export function ActionSheet({
  visible,
  onClose,
  title,
  message,
  icon,
  actions,
  cancelLabel = "Cancel",
}: ActionSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.card, paddingBottom: spacing.md + insets.bottom },
        ]}
        accessibilityViewIsModal
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        {icon ? (
          <View style={[styles.iconWrap, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name={icon} size={28} color={colors.accent} />
          </View>
        ) : null}
        {title ? (
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        {message ? <Text style={[styles.message, { color: colors.muted }]}>{message}</Text> : null}

        <View style={styles.actions}>
          {actions.map((action) => {
            const primary = action.tone === "primary";
            const foreground = primary
              ? colors.onPrimary
              : action.tone === "danger"
                ? colors.rose
                : colors.text;
            return (
              <Pressable
                key={action.label}
                onPress={action.onPress}
                disabled={action.loading}
                style={({ pressed }) => [
                  styles.action,
                  primary
                    ? [styles.primary, { backgroundColor: colors.accent }]
                    : { backgroundColor: colors.inputBg },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={action.label}
              >
                {action.loading ? (
                  <ActivityIndicator color={foreground} />
                ) : (
                  <>
                    {action.icon ? (
                      <Ionicons name={action.icon} size={20} color={foreground} />
                    ) : null}
                    <Text style={[styles.actionText, { color: foreground }]}>{action.label}</Text>
                  </>
                )}
              </Pressable>
            );
          })}
          {cancelLabel ? (
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
            >
              <Text style={[styles.actionText, { color: colors.muted }]}>{cancelLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    marginBottom: spacing.sm,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
  actions: {
    alignSelf: "stretch",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  action: {
    minHeight: 50,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  primary: {
    minHeight: 54,
  },
  actionText: {
    fontSize: 16,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.7,
  },
});
