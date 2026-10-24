import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";

type SearchFieldProps = {
  value: string;
  onChange: (next: string) => void;
  onClear: () => void;
  placeholder?: string;
  accessibilityLabel?: string;
};

export function SearchField({
  value,
  onChange,
  onClear,
  placeholder = "Search by name or language",
  accessibilityLabel = "Search partners by name or language",
}: SearchFieldProps) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          shadowColor: colors.shadow,
        },
      ]}
    >
      <Ionicons
        name="search"
        size={18}
        color={colors.muted}
        style={styles.icon}
        accessibilityElementsHidden
      />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={accessibilityLabel}
        style={[styles.input, { color: colors.text }]}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={onClear}
          hitSlop={10}
          style={styles.clear}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Text style={[styles.clearText, { color: colors.muted }]}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 6,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 1,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 22,
    paddingVertical: 12,
  },
  clear: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  clearText: {
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 24,
  },
});
