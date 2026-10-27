import { useMemo, useState } from "react";
import { FlatList, Modal, Platform, StyleSheet, Text, TextInput } from "react-native";

import { KeyboardSafeView } from "@/shared/components/KeyboardSafeView";
import { ModalSafeFrame } from "@/shared/components/ModalSafeFrame";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";
import { SafePressable, SafeView } from "@/shared/utils/withoutTextNodes";

import type { Language } from "../types";
import { filterLanguageCatalog, languageFlag, languageNativeName } from "../utils";
import { SelectionMark } from "./SelectionMark";

type LanguageCatalogModalProps = {
  visible: boolean;
  languages: Language[];
  selectedIds: Set<string>;
  title: string;
  disableSelected?: boolean;
  variant?: "sheet" | "fullscreen";
  highlightId?: string | null;
  onSelect: (language: Language) => void;
  onClose: () => void;
};

function LanguagePickerRow({
  language,
  selected,
  blocked,
  colors,
  onPress,
}: {
  language: Language;
  selected: boolean;
  blocked: boolean;
  colors: ReturnType<typeof useColors>;
  onPress: () => void;
}) {
  return (
    <SafePressable
      onPress={onPress}
      disabled={blocked}
      style={[styles.fullRow, blocked && styles.rowTaken]}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: blocked }}
      accessibilityLabel={
        blocked ? `${language.name} is already in your languages` : `Select ${language.name}`
      }
    >
      <SafeView style={[styles.flagCircle, { backgroundColor: colors.accentSoft }]}>
        <Text style={styles.flag}>{languageFlag(language)}</Text>
      </SafeView>
      <SafeView style={styles.rowText}>
        <Text style={[styles.name, { color: colors.text }]}>{language.name}</Text>
        <Text style={[styles.nativeName, { color: colors.muted }]}>
          {languageNativeName(language)}
        </Text>
      </SafeView>
      <SelectionMark selected={selected} />
    </SafePressable>
  );
}

export function LanguageCatalogModal({
  visible,
  languages,
  selectedIds,
  title,
  disableSelected = true,
  variant = "sheet",
  highlightId = null,
  onSelect,
  onClose,
}: LanguageCatalogModalProps) {
  const colors = useColors();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const filtered = useMemo(() => filterLanguageCatalog(languages, query), [languages, query]);

  const highlightedLanguage = useMemo(() => {
    if (!highlightId) {
      return null;
    }
    return languages.find((item) => item.id === highlightId || item.code === highlightId) ?? null;
  }, [highlightId, languages]);

  const listLanguages = useMemo(() => {
    if (variant !== "fullscreen" || !highlightedLanguage) {
      return filtered;
    }
    return filtered.filter(
      (item) => item.id !== highlightedLanguage.id && item.code !== highlightedLanguage.code,
    );
  }, [filtered, highlightedLanguage, variant]);

  const handleClose = () => {
    setQuery("");
    setSearchOpen(false);
    onClose();
  };

  const isBlocked = (language: Language) => {
    const taken = selectedIds.has(language.id) || selectedIds.has(language.code);
    if (!taken) {
      return false;
    }
    if (!disableSelected) {
      return false;
    }
    const isHighlighted =
      highlightId !== null && (language.id === highlightId || language.code === highlightId);
    return !isHighlighted;
  };

  const handleSelect = (language: Language) => {
    if (isBlocked(language)) {
      return;
    }
    setQuery("");
    setSearchOpen(false);
    onSelect(language);
  };

  if (variant === "fullscreen") {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent={Platform.OS === "android"}
        onRequestClose={handleClose}
      >
        <ModalSafeFrame>
          <KeyboardSafeView>
            <SafeView style={styles.fullHeader}>
              <SafePressable
                onPress={handleClose}
                hitSlop={12}
                style={styles.iconButton}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Text style={[styles.backIcon, { color: colors.text }]}>{"←"}</Text>
              </SafePressable>
              <Text style={[styles.fullTitle, { color: colors.text }]}>{title}</Text>
              <SafePressable
                onPress={() => setSearchOpen((value) => !value)}
                hitSlop={12}
                style={styles.iconButton}
                accessibilityRole="button"
                accessibilityState={{ selected: searchOpen }}
                accessibilityLabel="Search languages"
              >
                <Text style={[styles.searchIcon, { color: colors.text }]}>{"⌕"}</Text>
              </SafePressable>
            </SafeView>

            {searchOpen ? (
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search languages"
                placeholderTextColor={colors.placeholder}
                autoCorrect={false}
                autoCapitalize="none"
                autoFocus
                accessibilityLabel="Search languages"
                style={[
                  styles.fullSearch,
                  {
                    borderColor: colors.cardBorder,
                    backgroundColor: colors.inputBg,
                    color: colors.text,
                  },
                ]}
              />
            ) : null}

            <FlatList
              showsVerticalScrollIndicator={false}
              data={listLanguages}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={24}
              windowSize={8}
              contentContainerStyle={styles.fullListContent}
              ListHeaderComponent={
                highlightedLanguage ? (
                  <SafeView>
                    <Text style={[styles.selectedHeading, { color: colors.label }]}>
                      Selected language
                    </Text>
                    <LanguagePickerRow
                      language={highlightedLanguage}
                      selected
                      blocked={false}
                      colors={colors}
                      onPress={handleClose}
                    />
                    <SafeView
                      style={[styles.selectedDivider, { backgroundColor: colors.border }]}
                    />
                  </SafeView>
                ) : undefined
              }
              renderItem={({ item }) => (
                <LanguagePickerRow
                  language={item}
                  selected={false}
                  blocked={isBlocked(item)}
                  colors={colors}
                  onPress={() => handleSelect(item)}
                />
              )}
              ListEmptyComponent={
                <Text style={[styles.empty, { color: colors.muted }]}>
                  {query.trim() ? `No languages match "${query.trim()}".` : "Catalog is empty."}
                </Text>
              }
            />
          </KeyboardSafeView>
        </ModalSafeFrame>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardSafeView style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <ModalSafeFrame
          edges={["bottom"]}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
            },
          ]}
        >
          <SafeView style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <SafePressable
              onPress={handleClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close catalog"
            >
              <Text style={[styles.close, { color: colors.accent }]}>Close</Text>
            </SafePressable>
          </SafeView>

          <Text style={[styles.headerHint, { color: colors.muted }]}>
            Search to find any language.
          </Text>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or ISO code…"
            placeholderTextColor={colors.placeholder}
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel="Search languages"
            style={[
              styles.search,
              {
                borderColor: colors.border,
                backgroundColor: colors.inputBg,
                color: colors.text,
              },
            ]}
          />

          <FlatList
            showsVerticalScrollIndicator={false}
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={24}
            windowSize={8}
            renderItem={({ item }) => {
              const blocked = isBlocked(item);
              const taken = selectedIds.has(item.id) || selectedIds.has(item.code);
              return (
                <SafePressable
                  onPress={() => handleSelect(item)}
                  disabled={blocked}
                  style={[
                    styles.row,
                    blocked && styles.rowTaken,
                    taken && !disableSelected && { backgroundColor: colors.accentSoft },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: blocked, selected: taken }}
                  accessibilityLabel={
                    blocked
                      ? `${item.name} is already in your languages`
                      : `Add ${item.name}, code ${item.code}`
                  }
                >
                  <Text style={styles.flag}>{languageFlag(item)}</Text>
                  <SafeView style={styles.rowText}>
                    <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.code, { color: colors.muted }]}>
                      {item.code.toUpperCase()}
                    </Text>
                  </SafeView>
                  {taken ? (
                    <Text style={[styles.added, { color: colors.muted }]}>
                      {disableSelected ? "Added ✓" : "Selected"}
                    </Text>
                  ) : null}
                </SafePressable>
              );
            }}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: colors.muted }]}>
                {query.trim() ? `No languages match "${query.trim()}".` : "Catalog is empty."}
              </Text>
            }
          />
        </ModalSafeFrame>
      </KeyboardSafeView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "92%",
    minHeight: "70%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    flex: undefined,
  },
  fullHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    fontSize: 24,
    fontWeight: "600",
  },
  searchIcon: {
    fontSize: 22,
    fontWeight: "600",
  },
  fullTitle: {
    flex: 1,
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  fullSearch: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 48,
    fontSize: 16,
  },
  fullListContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  selectedHeading: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.7,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
  },
  selectedDivider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
  fullRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 68,
    paddingVertical: 12,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
  },
  close: {
    fontWeight: "700",
    fontSize: 16,
  },
  headerHint: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  search: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: spacing.sm,
    minHeight: 54,
    fontSize: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    minHeight: 56,
  },
  rowTaken: {
    opacity: 0.45,
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
  name: {
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: -0.2,
  },
  nativeName: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },
  code: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  added: {
    fontWeight: "800",
    fontSize: 12,
  },
  empty: {
    textAlign: "center",
    marginTop: spacing.lg,
    fontWeight: "600",
  },
});
