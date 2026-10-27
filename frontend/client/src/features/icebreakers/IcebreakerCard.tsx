import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ICEBREAKER_ANSWER_MAX, sanitizeMultiline } from "@sayly/shared";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  View,
} from "react-native";

import { isApiError } from "@/lib/api/errors";
import type { AppStackParamList } from "@/navigation/types";
import { Chip } from "@/shared/components/Chip";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";
import { confirmAction } from "@/shared/utils/confirmAction";

import {
  useIcebreakerLanguage,
  useMyIcebreakerAnswer,
  usePracticeLanguages,
  useTodayIcebreaker,
} from "./hooks";

type IcebreakerCardProps = {
  /**
   * The answer field got focus; `offsetY` is its top inside the card. The card sits at the top
   * of a scrolling list, so the screen scrolls by that much to keep the field above the keyboard.
   */
  onComposerFocus?: (offsetY: number) => void;
  onComposerBlur?: () => void;
};

/**
 * "Today's icebreaker" on Community: one question a day in the language the member is learning
 * (they pick which one), answered right here on the card.
 */
export function IcebreakerCard({ onComposerFocus, onComposerBlur }: IcebreakerCardProps) {
  const colors = useColors();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const languages = usePracticeLanguages();
  const { language, select } = useIcebreakerLanguage(languages);
  const today = useTodayIcebreaker(language?.id);
  const { save, remove } = useMyIcebreakerAnswer(language?.id ?? "");
  const [showEnglish, setShowEnglish] = useState(false);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  // Composer is folded behind the "Answer" button until the member taps it.
  const [answering, setAnswering] = useState(false);
  const composerY = useRef(0);
  const inputRef = useRef<TextInputInstance>(null);
  const focusOnLayout = useRef(false);

  // A new language (or a new day's question) starts with an empty composer.
  const promptKey = today.data ? `${today.data.prompt.languageId}:${today.data.prompt.date}` : "";
  useEffect(() => {
    setDraft("");
    setEditing(false);
    setAnswering(false);
    setShowEnglish(false);
    save.reset();
    remove.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the prompt changes
  }, [promptKey]);

  if (!language) {
    // No learning language yet: still show the card, with the way to get a daily question.
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.kicker, { color: colors.accent }]}>TODAY’S ICEBREAKER</Text>
        <Text style={[styles.question, { color: colors.text }]}>
          Add a language you are learning to get a new question every day.
        </Text>
        <Pressable
          onPress={() => navigation.navigate("LanguagePreferences")}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.accent },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
        >
          <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Add a language</Text>
        </Pressable>
      </View>
    );
  }

  const data = today.data;
  const mine = data?.myAnswer ?? null;
  const composing = !mine || editing;
  const composerOpen = composing && (answering || editing || Boolean(draft));
  const cleaned = sanitizeMultiline(draft);
  const tooLong = cleaned.length > ICEBREAKER_ANSWER_MAX;
  const busy = save.isPending || remove.isPending;
  const failure = save.error ?? remove.error;
  const error = failure
    ? isApiError(failure)
      ? failure.message
      : "Could not save your answer. Please try again."
    : null;

  const send = () => {
    if (!cleaned || tooLong || busy) return;
    save.mutate(cleaned, {
      onSuccess: () => {
        setDraft("");
        setEditing(false);
        setAnswering(false);
      },
    });
  };

  const startEditing = () => {
    setDraft(mine?.body ?? "");
    focusOnLayout.current = true;
    setEditing(true);
  };

  const startAnswering = () => {
    focusOnLayout.current = true;
    setAnswering(true);
  };

  const confirmDelete = () =>
    confirmAction({
      title: "Delete your answer?",
      message: "Others will no longer see it today.",
      confirmLabel: "Delete",
      onConfirm: () => remove.mutate(),
    });

  return (
    <View
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
      accessibilityRole="summary"
    >
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: colors.accent }]}>TODAY’S ICEBREAKER</Text>
        {data && data.answerCount > 0 ? (
          <Text style={[styles.count, { color: colors.muted }]}>
            {data.answerCount} {data.answerCount === 1 ? "answer" : "answers"}
          </Text>
        ) : null}
      </View>

      <View style={styles.languages} accessibilityRole="radiogroup">
        <Text style={[styles.practise, { color: colors.muted }]}>Practise in</Text>
        {languages.map((item) => (
          <Chip
            key={item.id}
            label={`${item.flagEmoji ?? ""} ${item.name}`.trim()}
            selected={item.id === language.id}
            onPress={() => select(item.id)}
          />
        ))}
      </View>

      {today.isPending ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : !data ? (
        <Pressable onPress={() => void today.refetch()} accessibilityRole="button">
          <Text style={[styles.note, { color: colors.muted }]}>
            Could not load today’s question. Tap to retry.
          </Text>
        </Pressable>
      ) : (
        <>
          <Text style={[styles.question, { color: colors.text }]}>
            {showEnglish ? data.prompt.english : data.prompt.text}
          </Text>
          {data.prompt.translated ? (
            data.prompt.text !== data.prompt.english ? (
              <Pressable
                onPress={() => setShowEnglish((value) => !value)}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={[styles.link, { color: colors.muted }]}>
                  {showEnglish ? `Show in ${language.name}` : "Show in English"}
                </Text>
              </Pressable>
            ) : null
          ) : (
            <Text style={[styles.note, { color: colors.muted }]}>
              This question is in English for now. Answer in {language.name}.
            </Text>
          )}

          {composing && !composerOpen ? (
            <View style={styles.ctaRow}>
              <Pressable
                onPress={startAnswering}
                style={({ pressed }) => [
                  styles.button,
                  styles.ctaPrimary,
                  { backgroundColor: colors.accent },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Answer in ${language.name}`}
              >
                <Ionicons name="create-outline" size={18} color={colors.onPrimary} />
                <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Answer</Text>
              </Pressable>
              <Text style={[styles.ctaHint, { color: colors.muted }]}>
                {data.answerCount > 0
                  ? "Join in — others have already answered"
                  : "Be the first to answer today"}
              </Text>
            </View>
          ) : composing ? (
            <View
              style={styles.composer}
              onLayout={(event) => {
                composerY.current = event.nativeEvent.layout.y;
                if (focusOnLayout.current) {
                  focusOnLayout.current = false;
                  inputRef.current?.focus();
                }
              }}
            >
              <View
                style={[
                  styles.inputRow,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: tooLong || error ? colors.rose : "transparent",
                  },
                ]}
              >
                <TextInput
                  ref={inputRef}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={`Answer in ${language.name}…`}
                  placeholderTextColor={colors.placeholder}
                  multiline
                  maxLength={ICEBREAKER_ANSWER_MAX + 50}
                  editable={!busy}
                  onFocus={() => onComposerFocus?.(composerY.current)}
                  onBlur={() => {
                    // Fold back to the "Answer" button when left empty.
                    if (!draft.trim() && !editing) setAnswering(false);
                    onComposerBlur?.();
                  }}
                  style={[styles.input, { color: colors.text }]}
                  accessibilityLabel={`Your answer in ${language.name}`}
                />
                <Pressable
                  onPress={send}
                  disabled={!cleaned || tooLong || busy}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.send,
                    { backgroundColor: colors.accent },
                    (!cleaned || tooLong || busy || pressed) && styles.dimmed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={mine ? "Update answer" : "Send answer"}
                >
                  {save.isPending ? (
                    <ActivityIndicator color={colors.onPrimary} size="small" />
                  ) : (
                    <Ionicons name="arrow-up" size={20} color={colors.onPrimary} />
                  )}
                </Pressable>
              </View>
              <View style={styles.metaRow}>
                <Text
                  style={[styles.error, { color: colors.rose }]}
                  accessibilityLiveRegion="polite"
                >
                  {error ?? (tooLong ? `Keep it under ${ICEBREAKER_ANSWER_MAX} characters.` : "")}
                </Text>
                {draft ? (
                  <Text style={[styles.counter, { color: tooLong ? colors.rose : colors.muted }]}>
                    {cleaned.length}/{ICEBREAKER_ANSWER_MAX}
                  </Text>
                ) : null}
              </View>
              {editing ? (
                <Pressable onPress={() => setEditing(false)} hitSlop={8} accessibilityRole="button">
                  <Text style={[styles.link, { color: colors.muted }]}>Cancel editing</Text>
                </Pressable>
              ) : null}
            </View>
          ) : mine ? (
            <View style={[styles.mine, { backgroundColor: colors.accentSoft }]}>
              <Text style={[styles.mineLabel, { color: colors.accent }]}>Your answer</Text>
              <Text style={[styles.mineBody, { color: colors.text }]}>{mine.body}</Text>
              <View style={styles.mineActions}>
                <Pressable onPress={startEditing} hitSlop={8} accessibilityRole="button">
                  <Text style={[styles.action, { color: colors.accent }]}>Edit</Text>
                </Pressable>
                <Pressable
                  onPress={confirmDelete}
                  disabled={busy}
                  hitSlop={8}
                  accessibilityRole="button"
                >
                  <Text style={[styles.action, { color: colors.rose }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <Pressable
            onPress={() =>
              navigation.navigate("IcebreakerAnswers", {
                languageId: language.id,
                languageName: language.name,
                question: data.prompt.text,
              })
            }
            style={({ pressed }) => [
              styles.secondary,
              { borderColor: colors.cardBorder },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="See answers and start a conversation"
          >
            <Ionicons name="chatbubbles-outline" size={18} color={colors.text} />
            <Text style={[styles.secondaryText, { color: colors.text }]}>
              {data.answerCount > 0 ? "See answers and reply" : "See who answers"}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kicker: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  count: {
    fontSize: 12,
    fontWeight: "600",
  },
  languages: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs,
  },
  practise: {
    fontSize: 13,
    fontWeight: "600",
  },
  loading: {
    paddingVertical: spacing.md,
  },
  note: {
    fontSize: 13,
    lineHeight: 18,
  },
  question: {
    fontSize: 19,
    lineHeight: 26,
    fontWeight: "800",
  },
  link: {
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  composer: {
    gap: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingLeft: spacing.md,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 140,
    fontSize: 16,
    paddingTop: 8,
    paddingBottom: 8,
    textAlignVertical: "top",
  },
  send: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
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
  mine: {
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 4,
  },
  mineLabel: {
    fontSize: 12,
    fontWeight: "800",
  },
  mineBody: {
    fontSize: 15,
    lineHeight: 21,
  },
  mineActions: {
    flexDirection: "row",
    gap: spacing.lg,
    marginTop: 2,
  },
  action: {
    fontSize: 14,
    fontWeight: "800",
  },
  button: {
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "800",
  },
  secondary: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: "700",
  },
  ctaRow: {
    gap: 6,
  },
  ctaPrimary: {
    flexDirection: "row",
    gap: 6,
    minHeight: 48,
  },
  ctaHint: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  dimmed: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.75,
  },
});
