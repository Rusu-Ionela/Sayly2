import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { KeyboardSafeView } from "@/shared/components/KeyboardSafeView";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

export type PickerItem = {
  key: string;
  label: string;
  /** Second line under the label (e.g. a country code). */
  detail?: string;
  /** Left of the label (e.g. a flag emoji). */
  leading?: string;
};

type SearchablePickerProps = {
  /** Text on the closed field; the placeholder is shown when empty. */
  valueLabel: string;
  placeholder: string;
  leading?: string;
  accessibilityLabel: string;
  sheetTitle: string;
  searchPlaceholder: string;
  items: readonly PickerItem[];
  selectedKey?: string;
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (item: PickerItem) => void;
  /** Shows an × on the field that calls this. */
  onClear?: () => void;
  disabled?: boolean;
  /** Small print under the field (e.g. why it is disabled). */
  hint?: string;
  loading?: boolean;
  emptyText: string;
  /** Extra content above the list (e.g. an error). */
  listHeader?: ReactNode;
};

/** A field that opens a bottom sheet with a search box and a list — countries, cities. */
export function SearchablePicker({
  valueLabel,
  placeholder,
  leading,
  accessibilityLabel,
  sheetTitle,
  searchPlaceholder,
  items,
  selectedKey,
  query,
  onQueryChange,
  onSelect,
  onClear,
  disabled = false,
  hint,
  loading = false,
  emptyText,
  listHeader,
}: SearchablePickerProps) {
  const colors = useColors();
  const [open, setOpen] = useState(false);

  const close = () => {
    setOpen(false);
    onQueryChange("");
  };

  const select = (item: PickerItem) => {
    onSelect(item);
    close();
  };

  return (
    <View>
      <Pressable
        style={[
          styles.trigger,
          { borderColor: colors.cardBorder, backgroundColor: colors.card },
          disabled && styles.disabled,
        ]}
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
      >
        {leading ? <Text style={styles.triggerLeading}>{leading}</Text> : null}
        <Text
          style={[
            styles.triggerText,
            { color: colors.text },
            !valueLabel ? { color: colors.muted, fontWeight: "500" } : null,
          ]}
          numberOfLines={1}
        >
          {valueLabel || placeholder}
        </Text>
        {onClear && valueLabel && !disabled ? (
          <Pressable
            onPress={onClear}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${accessibilityLabel.toLowerCase()}`}
          >
            <Text style={[styles.chevron, { color: colors.muted }]}>×</Text>
          </Pressable>
        ) : (
          <Text style={[styles.chevron, { color: colors.muted }]}>›</Text>
        )}
      </Pressable>
      {hint ? <Text style={[styles.hint, { color: colors.muted }]}>{hint}</Text> : null}

      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
        <KeyboardSafeView style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>{sheetTitle}</Text>
              <Pressable onPress={close} hitSlop={12} accessibilityRole="button">
                <Text style={[styles.close, { color: colors.accent }]}>Close</Text>
              </Pressable>
            </View>

            <TextInput
              value={query}
              onChangeText={onQueryChange}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.muted}
              autoCorrect={false}
              style={[
                styles.search,
                {
                  borderColor: colors.cardBorder,
                  backgroundColor: colors.background,
                  color: colors.text,
                },
              ]}
            />
            {listHeader}

            <FlatList
              showsVerticalScrollIndicator={false}
              data={items}
              keyExtractor={(item) => item.key}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={24}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => select(item)}
                  style={[
                    styles.row,
                    item.key === selectedKey ? { backgroundColor: colors.accentSoft } : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: item.key === selectedKey }}
                >
                  {item.leading ? <Text style={styles.leading}>{item.leading}</Text> : null}
                  <View style={styles.rowText}>
                    <Text style={[styles.label, { color: colors.text }]}>{item.label}</Text>
                    {item.detail ? (
                      <Text style={[styles.detail, { color: colors.muted }]}>{item.detail}</Text>
                    ) : null}
                  </View>
                </Pressable>
              )}
              ListEmptyComponent={
                loading ? (
                  <ActivityIndicator style={styles.empty} color={colors.muted} />
                ) : (
                  <Text style={[styles.empty, { color: colors.muted }]}>{emptyText}</Text>
                )
              }
            />
          </View>
        </KeyboardSafeView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  disabled: {
    opacity: 0.5,
  },
  triggerLeading: {
    fontSize: 22,
  },
  triggerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  chevron: {
    fontSize: 18,
    fontWeight: "600",
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
  },
  sheet: {
    maxHeight: "88%",
    minHeight: "50%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  close: {
    fontWeight: "700",
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  leading: {
    fontSize: 24,
  },
  rowText: {
    flex: 1,
  },
  label: {
    fontWeight: "700",
    fontSize: 15,
  },
  detail: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  empty: {
    textAlign: "center",
    marginTop: spacing.lg,
  },
});
