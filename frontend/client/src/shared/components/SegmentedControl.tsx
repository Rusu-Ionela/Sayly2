import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/shared/theme";

type Option<T extends string> = { id: T; label: string };

type SegmentedControlProps<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (next: T) => void;
  /** Spoken suffix, e.g. "appearance" → "Dark appearance". */
  accessibilitySuffix?: string;
};

/** iOS-style segmented switch (Appearance, Certificates tabs). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilitySuffix,
}: SegmentedControlProps<T>) {
  const colors = useColors();

  return (
    <View style={[styles.segment, { backgroundColor: colors.inputBg }]} accessibilityRole="tablist">
      {options.map((option) => {
        const active = value === option.id;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            style={[styles.item, active && { backgroundColor: colors.card }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={
              accessibilitySuffix ? `${option.label} ${accessibilitySuffix}` : option.label
            }
          >
            <Text
              style={[
                styles.text,
                { color: active ? colors.accent : colors.muted },
                active && styles.textActive,
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  item: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
  },
  textActive: {
    fontWeight: "700",
  },
});
