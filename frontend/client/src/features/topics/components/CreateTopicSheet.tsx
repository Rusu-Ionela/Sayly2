import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip } from "@/shared/components/Chip";
import { KeyboardSafeView } from "@/shared/components/KeyboardSafeView";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";
import { sanitizeSingleLine, TOPIC_TITLE_MAX } from "@sayly/shared";

import { TOPIC_IDEAS, topicTitleError } from "../model/topicRules";

type CreateTopicSheetProps = {
  visible: boolean;
  existingTitles: readonly string[];
  /** The first topic is always main, so the switch is hidden. */
  isFirst: boolean;
  saving: boolean;
  serverError: string | null;
  onSubmit: (input: { title: string; isMain: boolean }) => void;
  onClose: () => void;
};

/** "Create a topic" bottom sheet: free text, starter ideas and a main-topic switch. */
export function CreateTopicSheet({
  visible,
  existingTitles,
  isFirst,
  saving,
  serverError,
  onSubmit,
  onClose,
}: CreateTopicSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [isMain, setIsMain] = useState(false);
  const [touched, setTouched] = useState(false);

  const error = topicTitleError(title, existingTitles);
  const shownError = (touched ? error : null) ?? serverError;
  const length = sanitizeSingleLine(title).length;

  const close = () => {
    setTitle("");
    setIsMain(false);
    setTouched(false);
    onClose();
  };

  const submit = () => {
    setTouched(true);
    if (error || saving) return;
    onSubmit({ title: sanitizeSingleLine(title), isMain: isFirst || isMain });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <KeyboardSafeView style={styles.avoider}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.card, paddingBottom: spacing.md + insets.bottom },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            Create a topic
          </Text>
          <Text style={[styles.hint, { color: colors.muted }]}>
            What would you love to talk about with a language partner?
          </Text>

          <TextInput
            value={title}
            onChangeText={setTitle}
            onBlur={() => setTouched(true)}
            onSubmitEditing={submit}
            placeholder="e.g. Learning to surf"
            placeholderTextColor={colors.placeholder}
            maxLength={TOPIC_TITLE_MAX + 20}
            autoFocus
            returnKeyType="done"
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.inputBg,
                borderColor: shownError ? colors.rose : "transparent",
              },
            ]}
            accessibilityLabel="Topic"
          />
          <View style={styles.metaRow}>
            <Text style={[styles.error, { color: colors.rose }]} accessibilityLiveRegion="polite">
              {shownError ?? ""}
            </Text>
            <Text
              style={[
                styles.counter,
                { color: length > TOPIC_TITLE_MAX ? colors.rose : colors.muted },
              ]}
            >
              {length}/{TOPIC_TITLE_MAX}
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.ideas}
            keyboardShouldPersistTaps="handled"
          >
            {TOPIC_IDEAS.map((idea) => (
              <Chip key={idea} label={idea} onPress={() => setTitle(idea)} />
            ))}
          </ScrollView>

          {isFirst ? null : (
            <Pressable
              onPress={() => setIsMain((value) => !value)}
              style={styles.switchRow}
              accessibilityRole="switch"
              accessibilityState={{ checked: isMain }}
              accessibilityLabel="Make this my main topic"
            >
              <Text style={[styles.switchLabel, { color: colors.text }]}>
                Make this my main topic
              </Text>
              <Switch
                value={isMain}
                onValueChange={setIsMain}
                trackColor={{ false: colors.border, true: colors.accentSoft }}
                thumbColor={isMain ? colors.accent : colors.muted}
                importantForAccessibility="no-hide-descendants"
                accessibilityElementsHidden
              />
            </Pressable>
          )}

          <Pressable
            onPress={submit}
            disabled={saving}
            style={({ pressed }) => [
              styles.save,
              { backgroundColor: colors.accent },
              (pressed || saving) && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Save topic"
          >
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={[styles.saveText, { color: colors.onPrimary }]}>Save topic</Text>
            )}
          </Pressable>
        </View>
      </KeyboardSafeView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  avoider: {
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
  },
  hint: {
    fontSize: 15,
    lineHeight: 21,
  },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    marginTop: spacing.xs,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  error: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  counter: {
    fontSize: 12,
    fontWeight: "600",
  },
  ideas: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
  save: {
    minHeight: 54,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
  },
  saveText: {
    fontSize: 16,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.75,
  },
});
