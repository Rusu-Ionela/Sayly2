import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";
import { REFERENCE_BODY_MAX, type SaveReferenceInput } from "@sayly/shared";

import { RATING_LABELS } from "../model/referenceSummary";

import { StarRating } from "./StarRating";

type ReferenceModalProps = {
  visible: boolean;
  name: string;
  initialBody: string;
  /** 0 when writing a new reference: the member must pick a rating. */
  initialRating: number;
  saving: boolean;
  /** Shown when a previous save or delete failed. */
  error: string | null;
  onSave: (input: SaveReferenceInput) => void;
  onDelete?: () => void;
  onClose: () => void;
};

export function ReferenceModal({
  visible,
  name,
  initialBody,
  initialRating,
  saving,
  error,
  onSave,
  onDelete,
  onClose,
}: ReferenceModalProps) {
  const colors = useColors();
  const [body, setBody] = useState(initialBody);
  const [rating, setRating] = useState(initialRating);

  useEffect(() => {
    if (visible) {
      setBody(initialBody);
      setRating(initialRating);
    }
  }, [visible, initialBody, initialRating]);

  const trimmed = body.trim();
  const canSave = Boolean(trimmed) && rating > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.flex} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.text }]}>
            {initialBody ? "Edit your reference" : `Write a reference for ${name}`}
          </Text>
          <Text style={[styles.hint, { color: colors.muted }]}>
            Public on their profile. Keep it kind and honest.
          </Text>
          <View style={styles.rating}>
            <StarRating value={rating} size={32} onChange={setRating} />
            <Text style={[styles.ratingLabel, { color: rating ? colors.text : colors.muted }]}>
              {RATING_LABELS[rating] ?? "Tap a star to rate your exchange"}
            </Text>
          </View>
          <TextInput
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={REFERENCE_BODY_MAX}
            placeholder="What was it like practising together?"
            placeholderTextColor={colors.muted}
            textAlignVertical="top"
            style={[
              styles.input,
              { color: colors.text, backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
            accessibilityLabel="Reference text"
          />
          <Text style={[styles.counter, { color: colors.muted }]}>
            {body.length}/{REFERENCE_BODY_MAX}
          </Text>
          {error ? <Text style={[styles.error, { color: colors.rose }]}>{error}</Text> : null}
          <View style={styles.actions}>
            {onDelete ? (
              <Pressable
                onPress={onDelete}
                disabled={saving}
                style={styles.secondary}
                accessibilityRole="button"
              >
                <Text style={[styles.secondaryText, { color: colors.rose }]}>Delete</Text>
              </Pressable>
            ) : (
              <Pressable onPress={onClose} style={styles.secondary} accessibilityRole="button">
                <Text style={[styles.secondaryText, { color: colors.muted }]}>Cancel</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => onSave({ rating, body: trimmed })}
              disabled={!canSave || saving}
              style={[
                styles.primary,
                { backgroundColor: colors.accent, opacity: canSave ? 1 : 0.5 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Save reference"
            >
              {saving ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { fontSize: 18, fontWeight: "700" },
  hint: { fontSize: 14 },
  rating: { alignItems: "center", gap: 6, paddingVertical: spacing.sm },
  ratingLabel: { fontSize: 14, fontWeight: "600" },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 16,
  },
  counter: { alignSelf: "flex-end", fontSize: 12 },
  error: { fontSize: 14, fontWeight: "600" },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  secondary: { paddingVertical: 12, paddingHorizontal: 8 },
  secondaryText: { fontSize: 16, fontWeight: "600" },
  primary: {
    minWidth: 110,
    height: 48,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontSize: 16, fontWeight: "700" },
});
