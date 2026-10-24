import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

import type { DiscoveryProficiencyFilter } from "../types";
import { DISCOVERY_PROFICIENCY_OPTIONS } from "../utils";

type ProficiencySelectorProps = {
  value?: DiscoveryProficiencyFilter | string;
  onChange: (next: DiscoveryProficiencyFilter | undefined) => void;
};

export function ProficiencySelector({ value, onChange }: ProficiencySelectorProps) {
  const colors = useColors();

  return (
    <View style={styles.row}>
      {DISCOVERY_PROFICIENCY_OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(active ? undefined : option.value)}
            style={[
              styles.chip,
              {
                borderColor: active ? colors.accent : colors.border,
                backgroundColor: active ? colors.accent : colors.inputBg,
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${option.label} proficiency`}
          >
            <Text style={[styles.chipText, { color: active ? colors.onPrimary : colors.text }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
