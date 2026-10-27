import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Platform, ScrollView, StyleSheet, Text } from "react-native";

import { ModalSafeFrame } from "@/shared/components/ModalSafeFrame";
import type { ProficiencyLevel, Language, LanguageSetupSection } from "../types";
import { useColors, type ThemeColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";
import { SafePressable, SafeView } from "@/shared/utils/withoutTextNodes";

import {
  LEARNING_LEVEL_OPTIONS,
  learningProficiencyLabel,
  normalizeLearningProficiency,
  proficiencyMeta,
} from "../constants";
import {
  languageSectionChangeLabel,
  languageSectionLevelHeading,
  languageSectionRemoveHint,
  languageSectionTitle,
} from "../languageSectionLabels";

import { languageFlag, languageNativeName } from "../utils";
import { SelectionMark } from "./SelectionMark";

type LanguageSectionEditorProps = {
  visible: boolean;
  section: LanguageSetupSection;
  language: Language;
  proficiency?: ProficiencyLevel;
  canRemove: boolean;
  isDraft?: boolean;
  originalLanguageId?: string;
  onSave?: (payload: { languageId: string; proficiency: ProficiencyLevel }) => void;
  onChangeLanguage: () => void;
  onRemove: () => void;
  onClose: () => void;
};

function SignalBars({ filled, colors }: { filled: number; colors: ThemeColors }) {
  return (
    <SafeView style={styles.signalBars} accessibilityElementsHidden>
      {[1, 2, 3].map((bar) => (
        <SafeView
          key={bar}
          style={[
            styles.signalBar,
            { height: 6 + bar * 4 },
            {
              backgroundColor: bar <= filled ? colors.primary : colors.border,
            },
          ]}
        />
      ))}
    </SafeView>
  );
}

export function LanguageSectionEditor({
  visible,
  section,
  language,
  proficiency,
  canRemove,
  isDraft = false,
  originalLanguageId,
  onSave,
  onChangeLanguage,
  onRemove,
  onClose,
}: LanguageSectionEditorProps) {
  const colors = useColors();
  const removeHint = languageSectionRemoveHint(section);
  const isLearning = section === "learning";
  const isSpoken = section === "native" || section === "fluent";

  const savedProficiency = useMemo(() => {
    if (isLearning) {
      return proficiency ? normalizeLearningProficiency(proficiency) : "BEGINNER";
    }
    if (proficiency === "NATIVE") {
      return "NATIVE" as const;
    }
    return "FLUENT" as const;
  }, [isLearning, proficiency]);

  const [draftProficiency, setDraftProficiency] = useState<ProficiencyLevel>(savedProficiency);

  useEffect(() => {
    if (visible) {
      setDraftProficiency(savedProficiency);
    }
  }, [visible, savedProficiency, language.id]);

  const isDirty =
    isDraft ||
    draftProficiency !== savedProficiency ||
    language.id !== (originalLanguageId ?? language.id);

  const handleSave = () => {
    if (!onSave) {
      return;
    }
    onSave({ languageId: language.id, proficiency: draftProficiency });
  };

  const showLevelHelp = () => {
    Alert.alert(
      "Language levels",
      LEARNING_LEVEL_OPTIONS.map(
        (option) =>
          `${option.label} (${proficiencyMeta(option.value).cefr}): ${proficiencyMeta(option.value).description}`,
      ).join("\n\n"),
    );
  };

  const languageRow = (
    <SafePressable
      onPress={onChangeLanguage}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={`Change ${language.name}`}
    >
      <SafeView style={[styles.flagCircle, { backgroundColor: colors.accentSoft }]}>
        <Text style={styles.flag}>{languageFlag(language)}</Text>
      </SafeView>
      <SafeView style={styles.rowText}>
        <Text style={[styles.languageName, { color: colors.text }]}>{language.name}</Text>
        <Text style={[styles.nativeName, { color: colors.muted }]}>
          {languageNativeName(language)}
        </Text>
      </SafeView>
      {isLearning || isSpoken ? (
        <Text style={[styles.levelPreview, { color: colors.segmentText }]}>
          {isLearning
            ? learningProficiencyLabel(draftProficiency)
            : draftProficiency === "NATIVE"
              ? "Native"
              : "Fluent"}
        </Text>
      ) : null}
      <Text style={[styles.chevron, { color: colors.placeholder }]} accessibilityElementsHidden>
        {">"}
      </Text>
    </SafePressable>
  );

  const removeBlock = (
    <>
      <SafePressable
        onPress={onRemove}
        disabled={!canRemove}
        style={[styles.removeButton, { borderColor: canRemove ? colors.error : colors.border }]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canRemove }}
        accessibilityLabel="Remove language"
      >
        <Text style={[styles.removeLabel, { color: canRemove ? colors.error : colors.muted }]}>
          Remove language
        </Text>
      </SafePressable>
      <Text style={[styles.hint, { color: colors.muted }]}>{removeHint}</Text>
    </>
  );

  const cardStyle = [styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }];

  const learningBody = (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.learningContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.sectionLabel, { color: colors.label }]}>
        {languageSectionChangeLabel(section)}
      </Text>
      <SafeView style={cardStyle}>{languageRow}</SafeView>
      <Text style={[styles.sectionLabel, styles.levelHeading, { color: colors.label }]}>
        {languageSectionLevelHeading(language.name)}
      </Text>
      <Text style={[styles.levelHelp, { color: colors.muted }]}>
        {"Not sure which level is right for you? "}
        <Text style={{ color: colors.primary, fontWeight: "600" }} onPress={showLevelHelp}>
          Learn more about the levels
        </Text>
      </Text>
      <SafeView style={cardStyle}>
        {LEARNING_LEVEL_OPTIONS.map((option, index) => {
          const selected = draftProficiency === option.value;
          return (
            <SafeView key={option.value}>
              {index > 0 ? (
                <SafeView style={[styles.cardDivider, { backgroundColor: colors.border }]} />
              ) : null}
              <SafePressable
                onPress={() => setDraftProficiency(option.value)}
                style={styles.levelRow}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={option.label}
              >
                <SignalBars filled={option.bars} colors={colors} />
                <Text style={[styles.levelLabel, { color: colors.text }]}>{option.label}</Text>
                <SelectionMark selected={selected} />
              </SafePressable>
            </SafeView>
          );
        })}
      </SafeView>
      {removeBlock}
    </ScrollView>
  );

  const spokenBody = (
    <SafeView style={styles.body}>
      <Text style={[styles.sectionLabel, { color: colors.label }]}>
        {languageSectionChangeLabel(section)}
      </Text>
      <SafeView style={cardStyle}>{languageRow}</SafeView>
      <Text style={[styles.sectionLabel, styles.levelHeading, { color: colors.label }]}>
        How well do you speak {language.name}?
      </Text>
      <SafeView style={cardStyle}>
        {(
          [
            { value: "NATIVE" as const, label: "Native" },
            { value: "FLUENT" as const, label: "Fluent" },
          ] as const
        ).map((option, index) => {
          const selected = draftProficiency === option.value;
          return (
            <SafeView key={option.value}>
              {index > 0 ? (
                <SafeView style={[styles.cardDivider, { backgroundColor: colors.border }]} />
              ) : null}
              <SafePressable
                onPress={() => setDraftProficiency(option.value)}
                style={styles.levelRow}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={option.label}
              >
                <Text style={[styles.levelLabel, { color: colors.text }]}>{option.label}</Text>
                <SelectionMark selected={selected} />
              </SafePressable>
            </SafeView>
          );
        })}
      </SafeView>
      {removeBlock}
    </SafeView>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent={Platform.OS === "android"}
      onRequestClose={onClose}
    >
      <ModalSafeFrame>
        <SafeView style={styles.header}>
          <SafePressable
            onPress={onClose}
            hitSlop={12}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={[styles.closeIcon, { color: colors.text }]}>{"×"}</Text>
          </SafePressable>
          <Text style={[styles.title, { color: colors.text }]}>
            {languageSectionTitle(section)}
          </Text>
          {onSave ? (
            <SafePressable
              onPress={handleSave}
              disabled={!isDirty}
              hitSlop={12}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityState={{ disabled: !isDirty }}
              accessibilityLabel="Save"
            >
              <Text style={[styles.saveLabel, { color: isDirty ? colors.primary : colors.muted }]}>
                {"Save"}
              </Text>
            </SafePressable>
          ) : (
            <SafeView style={styles.iconButton} />
          )}
        </SafeView>
        {isLearning ? learningBody : spokenBody}
      </ModalSafeFrame>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  iconButton: {
    width: 56,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  closeIcon: {
    fontSize: 28,
    fontWeight: "300",
    lineHeight: 30,
  },
  title: {
    flex: 1,
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  saveLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },
  learningContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.7,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
  },
  levelHeading: {
    marginTop: spacing.xl,
  },
  levelHelp: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 21,
    marginBottom: spacing.md,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 72,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 12,
  },
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 58,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 14,
  },
  flagCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  flag: {
    fontSize: 24,
  },
  rowText: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  nativeName: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },
  levelPreview: {
    fontSize: 14,
    fontWeight: "600",
  },
  levelLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  chevron: {
    fontSize: 22,
    fontWeight: "300",
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.md,
  },
  signalBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    width: 24,
  },
  signalBar: {
    width: 5,
    borderRadius: 2,
  },
  removeButton: {
    marginTop: spacing.xl,
    alignSelf: "center",
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  removeLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  hint: {
    marginTop: spacing.md,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 20,
  },
});
