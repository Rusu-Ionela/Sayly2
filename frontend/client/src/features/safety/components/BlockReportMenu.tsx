import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@/features/auth";
import { KeyboardSafeView } from "@/shared/components/KeyboardSafeView";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

import { useBlockUser, useReportUser } from "../hooks/useSafety";
import { REPORT_REASONS, type ReportReason } from "../types";

type BlockReportMenuProps = {
  visible: boolean;
  userId: string;
  userName: string;
  messageId?: string;
  onClose: () => void;
  onBlocked?: () => void;
};

type Mode = "menu" | "report";

export function BlockReportMenu({
  visible,
  userId,
  userName,
  messageId,
  onClose,
  onBlocked,
}: BlockReportMenuProps) {
  const colors = useColors();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("menu");
  const [reason, setReason] = useState<ReportReason>("Spam");
  const [details, setDetails] = useState("");
  const block = useBlockUser();
  const report = useReportUser();

  const busy = block.isPending || report.isPending;
  const isSelf = Boolean(user?.id && user.id === userId);

  const resetAndClose = () => {
    setMode("menu");
    setReason("Spam");
    setDetails("");
    onClose();
  };

  const handleBlock = () => {
    if (isSelf) {
      Alert.alert("Not available", "You cannot block your own account.");
      return;
    }
    Alert.alert(
      "Block user",
      `Block ${userName}? Their profile will disappear from Discover and messaging will stop.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () => {
            block.mutate(userId, {
              onSuccess: () => {
                Alert.alert("User blocked", `${userName} has been blocked.`);
                onBlocked?.();
                resetAndClose();
              },
              onError: () => Alert.alert("Could not block", "Please try again."),
            });
          },
        },
      ],
    );
  };

  const handleReport = () => {
    if (isSelf) {
      Alert.alert("Not available", "You cannot report your own account.");
      return;
    }
    report.mutate(
      {
        userId,
        reason,
        messageId,
        details: details.trim() || undefined,
      },
      {
        onSuccess: () => {
          Alert.alert("Report submitted", "Thanks. Our team will review this report.");
          resetAndClose();
        },
        onError: () => Alert.alert("Could not submit report", "Please try again."),
      },
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={resetAndClose}>
      <KeyboardSafeView style={styles.frame}>
        <Pressable style={styles.backdrop} onPress={resetAndClose} />
        <ScrollView
          style={[
            styles.sheet,
            { backgroundColor: colors.background, borderColor: colors.cardBorder },
          ]}
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {mode === "menu" ? (
            <>
              <Text style={[styles.title, { color: colors.text }]}>Safety</Text>
              <Text style={[styles.subtitle, { color: colors.muted }]}>Actions for {userName}</Text>
              <Pressable
                style={[styles.row, { borderTopColor: colors.cardBorder }]}
                onPress={handleBlock}
                disabled={busy || isSelf}
              >
                <Text style={[styles.danger, { color: colors.rose }]}>Block</Text>
              </Pressable>
              <Pressable
                style={[styles.row, { borderTopColor: colors.cardBorder }]}
                onPress={() => setMode("report")}
                disabled={busy || isSelf}
              >
                <Text style={[styles.label, { color: colors.text }]}>Report</Text>
              </Pressable>
              <Pressable
                style={[styles.row, { borderTopColor: colors.cardBorder }]}
                onPress={resetAndClose}
                disabled={busy}
              >
                <Text style={[styles.muted, { color: colors.muted }]}>Cancel</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: colors.text }]}>Report {userName}</Text>
              <Text style={[styles.subtitle, { color: colors.muted }]}>Choose a reason</Text>
              {REPORT_REASONS.map((item) => {
                const active = reason === item;
                return (
                  <Pressable
                    key={item}
                    style={[
                      styles.reason,
                      {
                        borderColor: active ? colors.accent : colors.cardBorder,
                        backgroundColor: active ? colors.accent : colors.card,
                      },
                    ]}
                    onPress={() => setReason(item)}
                  >
                    <Text
                      style={[
                        styles.reasonText,
                        { color: active ? colors.onPrimary : colors.text },
                      ]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
              <TextInput
                value={details}
                onChangeText={setDetails}
                placeholder="Optional details"
                placeholderTextColor={colors.muted}
                style={[
                  styles.input,
                  {
                    borderColor: colors.cardBorder,
                    backgroundColor: colors.card,
                    color: colors.text,
                  },
                ]}
                multiline
                maxLength={1000}
              />
              <View style={styles.actions}>
                <Pressable
                  style={[styles.secondary, { backgroundColor: colors.card }]}
                  onPress={() => setMode("menu")}
                  disabled={busy}
                >
                  <Text style={[styles.secondaryText, { color: colors.text }]}>Back</Text>
                </Pressable>
                <Pressable
                  style={[styles.primary, { backgroundColor: colors.accent }]}
                  onPress={handleReport}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <Text style={[styles.primaryText, { color: colors.onPrimary }]}>
                      Submit report
                    </Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardSafeView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(42, 40, 38, 0.35)",
  },
  frame: {
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 60,
  },
  sheet: {
    flexGrow: 0,
    borderRadius: 20,
    borderWidth: 1,
  },
  sheetContent: {
    padding: spacing.lg,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 4,
    marginBottom: spacing.md,
  },
  row: {
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  label: {
    fontWeight: "700",
    fontSize: 16,
  },
  danger: {
    fontWeight: "800",
    fontSize: 16,
  },
  muted: {
    fontWeight: "700",
    fontSize: 16,
  },
  reason: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: spacing.sm,
  },
  reasonText: {
    fontWeight: "700",
  },
  input: {
    minHeight: 80,
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.sm,
    textAlignVertical: "top",
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  secondary: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    fontWeight: "700",
  },
  primary: {
    flex: 1.3,
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    fontWeight: "800",
  },
});
