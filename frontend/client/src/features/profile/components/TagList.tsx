import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

type TagListProps<T extends string> = {
  /** Every allowed value, in display order (edit mode shows them all). */
  options: readonly T[];
  /** Selected values (view mode shows only these). */
  selected: readonly string[];
  /** When set, tags become toggle chips. */
  onToggle?: (value: T) => void;
  /** Edit mode: blocks adding more once reached (selected tags stay removable). */
  max?: number;
};

type TagProps<T extends string> = {
  value: T;
  selected: boolean;
  disabled: boolean;
  onToggle?: (value: T) => void;
};

function TagImpl<T extends string>({ value, selected, disabled, onToggle }: TagProps<T>) {
  const colors = useColors();

  if (!onToggle) {
    return (
      <View
        style={[
          styles.chip,
          { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
        ]}
      >
        <Text style={[styles.label, { color: colors.accent }]}>{value}</Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => onToggle(value)}
      disabled={disabled}
      style={[
        styles.chip,
        disabled && styles.disabled,
        {
          backgroundColor: selected ? colors.accent : colors.card,
          borderColor: selected ? colors.accent : colors.cardBorder,
        },
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={value}
    >
      <Text style={[styles.label, { color: selected ? colors.onPrimary : colors.text }]}>
        {value}
      </Text>
    </Pressable>
  );
}

const Tag = memo(TagImpl) as typeof TagImpl;

function TagListImpl<T extends string>({ options, selected, onToggle, max }: TagListProps<T>) {
  const visible = onToggle ? options : options.filter((value) => selected.includes(value));
  if (visible.length === 0) {
    return null;
  }
  const full = max !== undefined && selected.length >= max;

  return (
    <View style={styles.row}>
      {visible.map((value) => {
        const isSelected = selected.includes(value);
        return (
          <Tag
            key={value}
            value={value}
            selected={isSelected}
            disabled={full && !isSelected}
            onToggle={onToggle}
          />
        );
      })}
    </View>
  );
}

/** Practice goals and topics: read-only chips on profiles, toggle chips in the editor. */
export const TagList = memo(TagListImpl) as typeof TagListImpl;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontWeight: "600",
    fontSize: 14,
    lineHeight: 20,
  },
});
