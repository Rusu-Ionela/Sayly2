import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { KeyboardSafeView } from "@/shared/components/KeyboardSafeView";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

type ConnectionRequestSheetProps = {
  visible: boolean;
  userName: string;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (introMessage?: string) => void;
};

function suggestedIntro(userName: string) {
  const firstName = userName.trim().split(/\s+/)[0] || "there";
  return `Hi ${firstName}! I’d love to practise languages together.`;
}

/** Lets a member review and optionally personalize a consent request before it is sent. */
export function ConnectionRequestSheet({
  visible,
  userName,
  busy = false,
  onClose,
  onSubmit,
}: ConnectionRequestSheetProps) {
  const colors = useColors();
  const [introMessage, setIntroMessage] = useState("");

  useEffect(() => {
    if (visible) {
      setIntroMessage(suggestedIntro(userName));
    }
  }, [userName, visible]);

  const close = () => {
    if (!busy) onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardSafeView style={[styles.frame, { backgroundColor: colors.overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityLabel="Close connection request"
        />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.background, borderColor: colors.cardBorder },
          ]}
          accessibilityViewIsModal
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.text }]}>Connect with {userName}</Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            Add an optional introduction before you send.
          </Text>
          <TextInput
            value={introMessage}
            onChangeText={setIntroMessage}
            placeholder="Write a short introduction"
            placeholderTextColor={colors.muted}
            style={[
              styles.input,
              { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.text },
            ]}
            multiline
            maxLength={280}
            editable={!busy}
            accessibilityLabel="Connection request introduction"
          />
          <Text style={[styles.count, { color: colors.muted }]}>{introMessage.length}/280</Text>
          <View style={styles.actions}>
            <Pressable
              style={[styles.cancel, { backgroundColor: colors.card }]}
              onPress={close}
              disabled={busy}
              accessibilityRole="button"
            >
              <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.send, { backgroundColor: colors.accent }]}
              onPress={() => onSubmit(introMessage.trim() || undefined)}
              disabled={busy}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={[styles.sendText, { color: colors.onPrimary }]}>Send request</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardSafeView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  handle: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, marginBottom: spacing.xs },
  title: { fontSize: 20, fontWeight: "800" },
  body: { fontSize: 15, lineHeight: 21 },
  input: {
    minHeight: 100,
    maxHeight: 150,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    textAlignVertical: "top",
    fontSize: 16,
  },
  count: { alignSelf: "flex-end", fontSize: 12 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  cancel: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
  },
  cancelText: { fontWeight: "700" },
  send: {
    flex: 1.4,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
  },
  sendText: { fontWeight: "800" },
});
