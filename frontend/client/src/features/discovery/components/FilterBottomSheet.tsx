import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LanguageCatalogModal } from "@/features/languages/components/LanguageCatalogModal";
import { useLanguages } from "@/features/languages/hooks/useLanguages";
import type { Language } from "@/features/languages/types";
import { findCatalogLanguage, languageFlag } from "@/features/languages/utils";
import { KeyboardSafeView } from "@/shared/components/KeyboardSafeView";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";
import { type Country, countryFlagEmoji, findCountryByName, searchCountries } from "@sayly/shared";

import type { DiscoveryFilters } from "../types";
import { countryFlag } from "../utils";

import { ProficiencySelector } from "./ProficiencySelector";

type FilterBottomSheetProps = {
  visible: boolean;
  value: DiscoveryFilters;
  onClose: () => void;
  onApply: (next: DiscoveryFilters) => void;
};

type OverlayPicker = "spoken" | "learning" | "country" | null;

const EMPTY_FILTERS: DiscoveryFilters = {};

function FieldTrigger({
  label,
  value,
  placeholder,
  onPress,
  onClear,
}: {
  label: string;
  value?: string;
  placeholder: string;
  onPress: () => void;
  onClear?: () => void;
}) {
  const colors = useColors();

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>{label}</Text>
      <Pressable
        onPress={onPress}
        style={[styles.trigger, { borderColor: colors.border, backgroundColor: colors.inputBg }]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text
          style={[
            styles.triggerText,
            { color: value ? colors.text : colors.muted },
            !value && styles.placeholder,
          ]}
          numberOfLines={1}
        >
          {value ?? placeholder}
        </Text>
        {value && onClear ? (
          <Pressable onPress={onClear} hitSlop={8} accessibilityLabel={`Clear ${label}`}>
            <Text style={[styles.clear, { color: colors.muted }]}>×</Text>
          </Pressable>
        ) : (
          <Text style={[styles.chevron, { color: colors.muted }]}>›</Text>
        )}
      </Pressable>
    </View>
  );
}

export function FilterBottomSheet({ visible, value, onClose, onApply }: FilterBottomSheetProps) {
  const colors = useColors();
  const catalogQuery = useLanguages();
  const catalog = catalogQuery.data ?? [];
  const [draft, setDraft] = useState<DiscoveryFilters>(value);
  const [picker, setPicker] = useState<OverlayPicker>(null);
  const [countryQuery, setCountryQuery] = useState("");

  useEffect(() => {
    if (visible) {
      setDraft(value);
      setPicker(null);
      setCountryQuery("");
    }
  }, [visible, value]);

  const spoken = findCatalogLanguage(catalog, draft.spokenLanguage ?? "");
  const learning = findCatalogLanguage(catalog, draft.learningLanguage ?? "");
  const selectedCountry = draft.country ? findCountryByName(draft.country) : undefined;

  const selectedLanguageIds = useMemo(() => {
    const ids = new Set<string>();
    const current = picker === "spoken" ? draft.spokenLanguage : draft.learningLanguage;
    if (current) {
      ids.add(current);
    }
    return ids;
  }, [draft.learningLanguage, draft.spokenLanguage, picker]);

  const filteredCountries = useMemo(() => searchCountries(countryQuery), [countryQuery]);

  const pickLanguage = (language: Language) => {
    if (picker === "spoken") {
      setDraft((prev) => ({ ...prev, spokenLanguage: language.id }));
    }
    if (picker === "learning") {
      setDraft((prev) => ({ ...prev, learningLanguage: language.id }));
    }
    setPicker(null);
  };

  const pickCountry = (country: Country) => {
    setDraft((prev) => ({ ...prev, country: country.name }));
    setPicker(null);
    setCountryQuery("");
  };

  const sheetVisible = visible && picker === null;
  const sheetBg = { backgroundColor: colors.card };

  return (
    <>
      <Modal visible={sheetVisible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityLabel="Close filters"
          />
          <SafeAreaView style={[styles.sheet, sheetBg]} edges={["bottom"]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={[styles.title, { color: colors.text }]}>Filters</Text>
                <Text style={[styles.subtitle, { color: colors.muted }]}>
                  Find partners by language, level, and country
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close filters"
              >
                <Text style={[styles.close, { color: colors.accent }]}>Close</Text>
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.content}
            >
              <FieldTrigger
                label="They speak"
                value={spoken ? `${languageFlag(spoken)} ${spoken.name}` : undefined}
                placeholder="Any spoken language"
                onPress={() => setPicker("spoken")}
                onClear={
                  draft.spokenLanguage
                    ? () => setDraft((prev) => ({ ...prev, spokenLanguage: undefined }))
                    : undefined
                }
              />

              <FieldTrigger
                label="They learn"
                value={learning ? `${languageFlag(learning)} ${learning.name}` : undefined}
                placeholder="Any learning language"
                onPress={() => setPicker("learning")}
                onClear={
                  draft.learningLanguage
                    ? () => setDraft((prev) => ({ ...prev, learningLanguage: undefined }))
                    : undefined
                }
              />

              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.muted }]}>Proficiency</Text>
                <ProficiencySelector
                  value={draft.proficiency}
                  onChange={(proficiency) => setDraft((prev) => ({ ...prev, proficiency }))}
                />
                {draft.spokenLanguage && draft.learningLanguage && draft.proficiency ? (
                  <Text style={[styles.fieldHint, { color: colors.muted }]}>
                    When both language filters are set, proficiency applies to the spoken language
                    only.
                  </Text>
                ) : null}
              </View>

              <FieldTrigger
                label="Country"
                value={
                  draft.country
                    ? `${countryFlag(draft.country)} ${selectedCountry?.name ?? draft.country}`
                    : undefined
                }
                placeholder="Any country"
                onPress={() => setPicker("country")}
                onClear={
                  draft.country
                    ? () => setDraft((prev) => ({ ...prev, country: undefined }))
                    : undefined
                }
              />
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                style={[styles.reset, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => setDraft(EMPTY_FILTERS)}
                accessibilityRole="button"
                accessibilityLabel="Reset filters"
              >
                <Text style={[styles.resetText, { color: colors.text }]}>Reset filters</Text>
              </Pressable>
              <Pressable
                style={[styles.apply, { backgroundColor: colors.accent }]}
                onPress={() => onApply(draft)}
                accessibilityRole="button"
                accessibilityLabel="Apply filters"
              >
                <Text style={[styles.applyText, { color: colors.onPrimary }]}>Apply filters</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      <LanguageCatalogModal
        visible={visible && (picker === "spoken" || picker === "learning")}
        languages={catalog}
        selectedIds={selectedLanguageIds}
        disableSelected={false}
        title={picker === "spoken" ? "They speak" : "They learn"}
        onSelect={pickLanguage}
        onClose={() => setPicker(null)}
      />

      <Modal
        visible={visible && picker === "country"}
        transparent
        animationType="slide"
        onRequestClose={() => setPicker(null)}
      >
        <KeyboardSafeView style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <SafeAreaView style={[styles.countrySheet, sheetBg]} edges={["bottom"]}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>Country</Text>
              <Pressable
                onPress={() => setPicker(null)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close country picker"
              >
                <Text style={[styles.close, { color: colors.accent }]}>Close</Text>
              </Pressable>
            </View>
            <TextInput
              value={countryQuery}
              onChangeText={setCountryQuery}
              placeholder="Search country…"
              placeholderTextColor={colors.muted}
              autoCorrect={false}
              accessibilityLabel="Search country"
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
              style={styles.countryList}
              data={filteredCountries}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={24}
              renderItem={({ item }) => {
                const active = draft.country === item.name;
                return (
                  <Pressable
                    onPress={() => pickCountry(item)}
                    style={[styles.countryRow, active && { backgroundColor: colors.accentSoft }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={item.name}
                  >
                    <Text style={styles.flag}>{countryFlagEmoji(item.code)}</Text>
                    <View style={styles.countryMeta}>
                      <Text style={[styles.countryName, { color: colors.text }]}>{item.name}</Text>
                      <Text style={[styles.countryCode, { color: colors.muted }]}>{item.code}</Text>
                    </View>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <Text style={[styles.empty, { color: colors.muted }]}>
                  {countryQuery.trim()
                    ? `No countries match “${countryQuery.trim()}”.`
                    : "No countries."}
                </Text>
              }
            />
          </SafeAreaView>
        </KeyboardSafeView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "88%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  countrySheet: {
    maxHeight: "92%",
    minHeight: "70%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  countryList: {
    flex: 1,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 999,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 20,
    marginTop: 4,
  },
  close: {
    fontWeight: "700",
    fontSize: 16,
    marginTop: 4,
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  fieldHint: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  trigger: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  triggerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  placeholder: {
    fontWeight: "500",
  },
  chevron: {
    fontSize: 18,
    fontWeight: "600",
  },
  clear: {
    fontSize: 22,
    fontWeight: "600",
    lineHeight: 22,
  },
  footer: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  reset: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  resetText: {
    fontWeight: "700",
    fontSize: 15,
  },
  apply: {
    flex: 1.4,
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  applyText: {
    fontWeight: "700",
    fontSize: 15,
  },
  search: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 54,
    marginBottom: spacing.sm,
    fontSize: 16,
  },
  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    minHeight: 56,
  },
  flag: {
    fontSize: 24,
  },
  countryMeta: {
    flex: 1,
  },
  countryName: {
    fontWeight: "700",
    fontSize: 15,
  },
  countryCode: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  empty: {
    textAlign: "center",
    marginTop: spacing.lg,
    fontWeight: "600",
  },
});
