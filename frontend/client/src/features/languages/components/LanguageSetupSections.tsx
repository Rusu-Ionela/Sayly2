import { useMemo, useRef, useState } from "react";
import { StyleSheet, Text } from "react-native";

import type { ProficiencyLevel, UserLanguageSelection } from "../types";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";
import { SafePressable, SafeView } from "@/shared/utils/withoutTextNodes";

import {
  learningProficiencyLabel,
  MAX_LEARNING_LANGUAGES,
  MAX_NATIVE_LANGUAGES,
  MAX_SPOKEN_LANGUAGES,
} from "../constants";
import { languageSectionTitle } from "../languageSectionLabels";
import type { Language, LanguageSetupSection } from "../types";
import { languageFlag, languageNativeName, selectedLanguageIdsFromLists } from "../utils";
import { LanguageCatalogModal } from "./LanguageCatalogModal";
import { LanguageSectionEditor } from "./LanguageSectionEditor";

export type { LanguageSetupSection };

type CatalogState = {
  section: LanguageSetupSection;
  mode: "add" | "change";
  replaceLanguageId?: string;
};

type EditorState = {
  section: LanguageSetupSection;
  languageId: string;
  originalLanguageId?: string;
  isNew?: boolean;
};

type LanguageSetupSectionsProps = {
  languages: Language[];
  spokenLanguages: UserLanguageSelection[];
  learningLanguages: UserLanguageSelection[];
  onSpokenChange: (next: UserLanguageSelection[]) => void;
  onLearningChange: (next: UserLanguageSelection[]) => void;
  onLimitReached?: (message: string) => void;
  /** Limits the editor to one part of setup. Defaults to native, fluent, and learning. */
  sections?: LanguageSetupSection[];
};

const NATIVE_PROFICIENCY: ProficiencyLevel = "NATIVE";
const FLUENT_DEFAULT: ProficiencyLevel = "FLUENT";

function isNativeSpoken(item: UserLanguageSelection) {
  return item.proficiency === "NATIVE";
}

function defaultProficiencyForSection(section: LanguageSetupSection): ProficiencyLevel {
  switch (section) {
    case "native":
      return NATIVE_PROFICIENCY;
    case "fluent":
      return FLUENT_DEFAULT;
    case "learning":
      return "BEGINNER";
  }
}

const ALL_SECTIONS: LanguageSetupSection[] = ["native", "fluent", "learning"];

export function LanguageSetupSections({
  languages,
  spokenLanguages,
  learningLanguages,
  onSpokenChange,
  onLearningChange,
  onLimitReached,
  sections = ALL_SECTIONS,
}: LanguageSetupSectionsProps) {
  const colors = useColors();
  const [catalog, setCatalog] = useState<CatalogState | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  /** Blocks catalog reopen from the same tap that closed it (modal press bleed-through). */
  const ignoreChangeLanguageUntilRef = useRef(0);

  const selectedIds = useMemo(
    () => selectedLanguageIdsFromLists(spokenLanguages, learningLanguages),
    [spokenLanguages, learningLanguages],
  );

  const nativeLanguages = spokenLanguages.filter(isNativeSpoken);
  const fluentLanguages = spokenLanguages.filter((item) => !isNativeSpoken(item));

  const resolveLanguage = (languageId: string) =>
    languages.find((entry) => entry.id === languageId || entry.code === languageId);

  const spokenCount = spokenLanguages.length;
  const learningCount = learningLanguages.length;

  const canAddToSection = (section: LanguageSetupSection): string | null => {
    if (section === "native" && nativeLanguages.length >= MAX_NATIVE_LANGUAGES) {
      return "You can only have one native language. Tap it to change or remove.";
    }
    if (section === "learning" && learningCount >= MAX_LEARNING_LANGUAGES) {
      return `You can learn up to ${MAX_LEARNING_LANGUAGES} languages.`;
    }
    if (section !== "learning" && spokenCount >= MAX_SPOKEN_LANGUAGES) {
      return `You can add up to ${MAX_SPOKEN_LANGUAGES} spoken languages.`;
    }
    return null;
  };

  const openCatalog = (next: CatalogState) => {
    if (next.mode === "add") {
      const blocked = canAddToSection(next.section);
      if (blocked) {
        onLimitReached?.(blocked);
        return;
      }
    }
    setCatalog(next);
  };

  const closeCatalog = () => setCatalog(null);

  const openSection = (section: LanguageSetupSection, items: UserLanguageSelection[]) => {
    if (items.length === 1) {
      const first = items[0];
      if (!first) {
        return;
      }
      setEditor({
        section,
        languageId: first.languageId,
        originalLanguageId: first.languageId,
      });
    }
  };

  const replaceSpokenLanguage = (
    languageId: string,
    nextLanguageId: string,
    proficiency: ProficiencyLevel,
  ) => {
    onSpokenChange(
      spokenLanguages.map((item) =>
        item.languageId === languageId ? { languageId: nextLanguageId, proficiency } : item,
      ),
    );
  };

  const handleCatalogSelect = (language: Language) => {
    if (!catalog) {
      return;
    }

    const { section, mode, replaceLanguageId } = catalog;
    ignoreChangeLanguageUntilRef.current = Date.now() + 500;
    setCatalog(null);

    if (section === "learning") {
      if (mode === "add") {
        setEditor({ section: "learning", languageId: language.id, isNew: true });
        return;
      }
      if (replaceLanguageId && editor?.section === "learning") {
        setEditor({
          ...editor,
          languageId: language.id,
          originalLanguageId: editor.originalLanguageId ?? replaceLanguageId,
        });
      }
      return;
    }

    const proficiency = defaultProficiencyForSection(section);
    if (mode === "add") {
      // Persist and return to the list — do not open the editor here.
      // Opening the editor under the same tap can re-fire and reopen the catalog.
      onSpokenChange([...spokenLanguages, { languageId: language.id, proficiency }]);
      return;
    }

    if (replaceLanguageId && editor) {
      setEditor({
        ...editor,
        section,
        languageId: language.id,
        originalLanguageId: editor.originalLanguageId ?? replaceLanguageId,
      });
    }
  };

  const applySpokenEditorChanges = () => {
    if (!editor || editor.section === "learning") {
      return;
    }

    const lookupId = editor.originalLanguageId ?? editor.languageId;
    const existing = spokenLanguages.find((item) => item.languageId === lookupId);
    if (!existing || existing.languageId === editor.languageId) {
      return;
    }

    replaceSpokenLanguage(lookupId, editor.languageId, existing.proficiency);
  };

  const handleEditorClose = () => {
    applySpokenEditorChanges();
    setEditor(null);
  };

  const handleLearningSave = ({
    languageId,
    proficiency,
  }: {
    languageId: string;
    proficiency: ProficiencyLevel;
  }) => {
    if (!editor || editor.section !== "learning") {
      return;
    }

    if (editor.isNew) {
      onLearningChange([...learningLanguages, { languageId, proficiency }]);
    } else {
      const lookupId = editor.originalLanguageId ?? editor.languageId;
      onLearningChange(
        learningLanguages.map((item) =>
          item.languageId === lookupId ? { languageId, proficiency } : item,
        ),
      );
    }
    setEditor(null);
  };

  const handleSpokenSave = ({
    languageId,
    proficiency,
  }: {
    languageId: string;
    proficiency: ProficiencyLevel;
  }) => {
    if (!editor || editor.section === "learning") {
      return;
    }

    const nextProficiency: ProficiencyLevel = proficiency === "NATIVE" ? "NATIVE" : "FLUENT";
    if (nextProficiency === "NATIVE") {
      const otherNatives = spokenLanguages.filter(
        (item) =>
          item.proficiency === "NATIVE" &&
          item.languageId !== (editor.originalLanguageId ?? editor.languageId),
      );
      if (otherNatives.length >= MAX_NATIVE_LANGUAGES) {
        onLimitReached?.(`You can only mark ${MAX_NATIVE_LANGUAGES} language as native.`);
        return;
      }
    }

    if (editor.isNew) {
      onSpokenChange([...spokenLanguages, { languageId, proficiency: nextProficiency }]);
    } else {
      const lookupId = editor.originalLanguageId ?? editor.languageId;
      onSpokenChange(
        spokenLanguages.map((item) =>
          item.languageId === lookupId ? { languageId, proficiency: nextProficiency } : item,
        ),
      );
    }
    setEditor(null);
  };

  const handleRemove = (section: LanguageSetupSection, languageId: string) => {
    if (editor?.isNew) {
      setEditor(null);
      return;
    }

    if (section === "learning") {
      if (learningLanguages.length <= 1) {
        onLimitReached?.("Keep at least one learning language.");
        return;
      }
      onLearningChange(learningLanguages.filter((item) => item.languageId !== languageId));
    } else {
      if (spokenLanguages.length <= 1) {
        onLimitReached?.("Keep at least one native or fluent language.");
        return;
      }
      onSpokenChange(spokenLanguages.filter((item) => item.languageId !== languageId));
    }
    setEditor(null);
  };

  const editorLanguage = editor ? resolveLanguage(editor.languageId) : null;
  const editorSelection =
    editor?.section === "learning" && !editor.isNew
      ? learningLanguages.find(
          (item) =>
            item.languageId === editor.languageId || item.languageId === editor.originalLanguageId,
        )
      : spokenLanguages.find((item) => item.languageId === editor?.languageId);
  const editorCanRemove =
    editor?.isNew ||
    (editor?.section === "learning" ? learningLanguages.length > 1 : spokenLanguages.length > 1);

  const catalogHighlightId =
    catalog?.mode === "change" ? (catalog.replaceLanguageId ?? editor?.languageId ?? null) : null;

  const renderSection = (
    section: LanguageSetupSection,
    items: UserLanguageSelection[],
    showProficiency: boolean,
  ) => {
    const canAddMore = section === "native" ? items.length < MAX_NATIVE_LANGUAGES : true;

    return (
      <SafeView style={styles.section}>
        <SafePressable
          onPress={() => openSection(section, items)}
          accessibilityRole="button"
          accessibilityLabel={languageSectionTitle(section)}
        >
          <Text style={[styles.sectionTitle, { color: colors.label }]}>
            {languageSectionTitle(section)}
          </Text>
        </SafePressable>
        <SafeView
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
            },
          ]}
        >
          {items.map((item, index) => {
            const language = resolveLanguage(item.languageId);
            if (!language) {
              return null;
            }

            return (
              <SafeView key={item.languageId}>
                {index > 0 ? (
                  <SafeView style={[styles.divider, { backgroundColor: colors.border }]} />
                ) : null}
                <SafePressable
                  onPress={() =>
                    setEditor({
                      section,
                      languageId: item.languageId,
                      originalLanguageId: item.languageId,
                    })
                  }
                  style={styles.row}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${language.name}`}
                >
                  <SafeView style={[styles.flagCircle, { backgroundColor: colors.accentSoft }]}>
                    <Text style={styles.flag}>{languageFlag(language)}</Text>
                  </SafeView>
                  <SafeView style={styles.rowText}>
                    <Text style={[styles.languageName, { color: colors.text }]}>
                      {language.name}
                    </Text>
                    <Text style={[styles.nativeName, { color: colors.muted }]}>
                      {languageNativeName(language)}
                    </Text>
                  </SafeView>
                  {showProficiency ? (
                    <Text style={[styles.proficiency, { color: colors.segmentText }]}>
                      {learningProficiencyLabel(item.proficiency)}
                    </Text>
                  ) : null}
                  <Text
                    style={[styles.chevron, { color: colors.placeholder }]}
                    accessibilityElementsHidden
                  >
                    {">"}
                  </Text>
                </SafePressable>
              </SafeView>
            );
          })}
          {canAddMore ? (
            <>
              {items.length > 0 ? (
                <SafeView style={[styles.divider, { backgroundColor: colors.border }]} />
              ) : null}
              <SafePressable
                onPress={() => openCatalog({ section, mode: "add" })}
                style={styles.addRow}
                accessibilityRole="button"
                accessibilityLabel={`Add language to ${languageSectionTitle(section)}`}
              >
                <SafeView style={[styles.addIcon, { backgroundColor: colors.accentSoft }]}>
                  <Text style={[styles.addIconText, { color: colors.primary }]}>{"+"}</Text>
                </SafeView>
                <Text style={[styles.addLabel, { color: colors.primary }]}>{"Add language"}</Text>
              </SafePressable>
            </>
          ) : null}
        </SafeView>
      </SafeView>
    );
  };

  const show = (section: LanguageSetupSection) => sections.includes(section);

  return (
    <SafeView style={styles.root}>
      {show("native") ? renderSection("native", nativeLanguages, false) : null}
      {show("fluent") ? renderSection("fluent", fluentLanguages, false) : null}
      {show("learning") ? renderSection("learning", learningLanguages, true) : null}
      {editor && editorLanguage ? (
        <LanguageSectionEditor
          visible={catalog === null}
          section={editor.section}
          language={editorLanguage}
          proficiency={editorSelection?.proficiency}
          canRemove={editorCanRemove}
          isDraft={editor.isNew}
          originalLanguageId={editor.originalLanguageId}
          onSave={editor.section === "learning" ? handleLearningSave : handleSpokenSave}
          onChangeLanguage={() => {
            if (Date.now() < ignoreChangeLanguageUntilRef.current) {
              return;
            }
            openCatalog({
              section: editor.section,
              mode: "change",
              replaceLanguageId: editor.languageId,
            });
          }}
          onRemove={() =>
            handleRemove(editor.section, editor.originalLanguageId ?? editor.languageId)
          }
          onClose={handleEditorClose}
        />
      ) : null}
      <LanguageCatalogModal
        visible={catalog !== null}
        variant="fullscreen"
        languages={languages}
        selectedIds={selectedIds}
        highlightId={catalogHighlightId}
        title={catalog ? languageSectionTitle(catalog.section) : "Add language"}
        onSelect={handleCatalogSelect}
        onClose={closeCatalog}
      />
    </SafeView>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.lg,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
    paddingHorizontal: 2,
  },
  sectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 68,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    gap: 12,
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
  proficiency: {
    fontSize: 13,
    fontWeight: "600",
    marginRight: 2,
  },
  chevron: {
    fontSize: 22,
    fontWeight: "300",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.md + 56,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 12,
  },
  addIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  addIconText: {
    fontSize: 26,
    fontWeight: "500",
    lineHeight: 28,
  },
  addLabel: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
});
