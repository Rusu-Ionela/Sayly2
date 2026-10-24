import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "Remove",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const colors = useColors();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card }]} accessibilityRole="alert">
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.muted }]}>{message}</Text>
          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              style={styles.cancelBtn}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={[styles.confirmBtn, { backgroundColor: `${colors.rose}55` }]}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
            >
              <Text style={[styles.confirmText, { color: colors.rose }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    borderRadius: 20,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
  },
  message: {
    fontWeight: "600",
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  cancelBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  confirmBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: "center",
  },
  cancelText: {
    fontWeight: "800",
  },
  confirmText: {
    fontWeight: "800",
  },
});
