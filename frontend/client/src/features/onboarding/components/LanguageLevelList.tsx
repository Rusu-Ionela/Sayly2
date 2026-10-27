import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LanguageCatalogModal } from "@/features/languages/components/LanguageCatalogModal";
import type { Language, ProficiencyLevel, UserLanguageSelection } from "@/features/languages/types";
import { languageFlag } from "@/features/languages/utils";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";
import { confirmAction } from "@/shared/utils/confirmAction";

import { PROFICIENCY_OPTIONS } from "../constants";

type LanguageLevelListProps = {
  languages: Language[];
  selected: UserLanguageSelection[];
  /** Languages already used in the other role (spoken vs learning). */
  blockedIds?: string[];
  addLabel?: string;
  catalogTitle?: string;
  maxItems?: number;
  minItems?: number;
  onToggle: (languageId: string) => void;
  onChangeProficiency: (languageId: string, proficiency: ProficiencyLevel) => void;
  onLimitReached?: (message: string) => void;
};

export function LanguageLevelList({
  languages,
  selected,
  blockedIds = [],
  addLabel = "Add language",
  catalogTitle = "Choose a language",
  maxItems,
  minItems = 0,
  onToggle,
  onChangeProficiency,
  onLimitReached,
}: LanguageLevelListProps) {
  const colors = useColors();
  const [catalogOpen, setCatalogOpen] = useState(false);

  const atMax = maxItems !== undefined && selected.length >= maxItems;

  const selectedIds = useMemo(() => {
    const ids = new Set(selected.map((item) => item.languageId));
    for (const id of blockedIds) {
      ids.add(id);
    }
    return ids;
  }, [blockedIds, selected]);

  const selectedRows = selected
    .map((item) => {
      const language = languages.find(
        (entry) => entry.id === item.languageId || entry.code === item.languageId,
      );
      return language ? { item, language } : null;
    })
    .filter((row): row is { item: UserLanguageSelection; language: Language } => row !== null);

  const handleAddPress = () => {
    if (atMax) {
      onLimitReached?.(`You can add up to ${maxItems} languages here.`);
      return;
    }
    setCatalogOpen(true);
  };

  const handleRemovePress = (languageId: string, name: string) => {
    if (selected.length <= minItems) {
      onLimitReached?.("Keep at least one language in this list.");
      return;
    }
    confirmAction({
      title: `Remove ${name}?`,
      message: "This language will be removed from your list.",
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
      onConfirm: () => onToggle(languageId),
    });
  };

  return (
    <View style={styles.list}>
      {maxItems !== undefined ? (
        <Text style={[styles.counter, { color: colors.text }]}>
          {selected.length}/{maxItems}
        </Text>
      ) : null}

      {selectedRows.map(({ item, language }) => (
        <View
          key={item.languageId}
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.accent,
            },
          ]}
        >
          <View style={styles.languageRow}>
            <Text style={styles.flag}>{languageFlag(language)}</Text>
            <View style={styles.meta}>
              <Text style={[styles.languageName, { color: colors.text }]}>{language.name}</Text>
              <Text style={[styles.languageCode, { color: colors.muted }]}>
                {language.code.toUpperCase()}
              </Text>
            </View>
            <Pressable
              onPress={() => handleRemovePress(item.languageId, language.name)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${language.name}`}
            >
              <Text style={[styles.remove, { color: colors.rose }]}>Remove</Text>
            </Pressable>
          </View>
          <View style={styles.levels}>
            {PROFICIENCY_OPTIONS.map((option) => {
              const active = item.proficiency === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => onChangeProficiency(item.languageId, option.value)}
                  style={[
                    styles.levelChip,
                    {
                      backgroundColor: active ? colors.accent : colors.background,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[styles.levelText, { color: active ? colors.onPrimary : colors.text }]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      {selected.length === 0 ? (
        <Text style={[styles.empty, { color: colors.muted }]}>
          None yet. Search and add from the catalog — popular languages appear first.
        </Text>
      ) : null}

      <Pressable
        style={[
          styles.addBtn,
          {
            borderColor: atMax ? colors.cardBorder : colors.accent,
            backgroundColor: colors.card,
            opacity: atMax ? 0.45 : 1,
          },
        ]}
        onPress={handleAddPress}
        disabled={atMax}
        accessibilityRole="button"
        accessibilityLabel={addLabel}
        accessibilityState={{ disabled: atMax }}
      >
        <Text style={[styles.addLabel, { color: colors.accent }]}>
          {atMax ? `Limit reached (${selected.length}/${maxItems})` : addLabel}
        </Text>
      </Pressable>

      <LanguageCatalogModal
        visible={catalogOpen}
        languages={languages}
        selectedIds={selectedIds}
        title={catalogTitle}
        onSelect={(language) => {
          if (maxItems !== undefined && selected.length >= maxItems) {
            onLimitReached?.(`You can add up to ${maxItems} languages here.`);
            setCatalogOpen(false);
            return;
          }
          setCatalogOpen(false);
          onToggle(language.id);
        }}
        onClose={() => setCatalogOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  card: {
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
  },
  languageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  flag: {
    fontSize: 24,
  },
  meta: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: "700",
  },
  languageCode: {
    fontSize: 12,
    fontWeight: "700",
  },
  remove: {
    fontWeight: "800",
    fontSize: 13,
  },
  levels: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  levelChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 32,
    justifyContent: "center",
  },
  levelText: {
    fontSize: 12,
    fontWeight: "600",
  },
  empty: {
    fontWeight: "600",
    fontSize: 13,
  },
  counter: {
    fontWeight: "800",
    fontSize: 13,
    alignSelf: "flex-end",
  },
  addBtn: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  addLabel: {
    fontWeight: "800",
    fontSize: 15,
  },
});
