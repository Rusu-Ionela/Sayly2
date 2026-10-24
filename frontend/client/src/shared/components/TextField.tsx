import { memo } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

type TextFieldProps = Omit<TextInputProps, "style"> & {
  label: string;
  error?: string;
  hint?: string;
  /** Shows a live "n/max" counter next to the label. */
  showCounter?: boolean;
};

/** Labelled input + hint + error + optional counter: every free-text field in a form. */
export const TextField = memo(function TextField({
  label,
  error,
  hint,
  showCounter = false,
  value = "",
  maxLength,
  multiline,
  ...inputProps
}: TextFieldProps) {
  const colors = useColors();
  const nearLimit = maxLength !== undefined && maxLength - value.length < 40;

  return (
    <View>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        {showCounter && maxLength !== undefined ? (
          <Text style={[styles.counter, { color: nearLimit ? colors.rose : colors.muted }]}>
            {value.length}/{maxLength}
          </Text>
        ) : null}
      </View>
      <TextInput
        {...inputProps}
        value={value}
        maxLength={maxLength}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        placeholderTextColor={colors.muted}
        accessibilityLabel={label}
        style={[
          styles.input,
          multiline && styles.multiline,
          {
            borderColor: error ? colors.rose : colors.cardBorder,
            backgroundColor: colors.card,
            color: colors.text,
          },
        ]}
      />
      {hint ? <Text style={[styles.hint, { color: colors.muted }]}>{hint}</Text> : null}
      {error ? <Text style={[styles.error, { color: colors.rose }]}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: spacing.sm,
    marginBottom: 6,
  },
  label: {
    fontWeight: "700",
  },
  counter: {
    fontWeight: "700",
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 54,
  },
  multiline: {
    minHeight: 110,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  error: {
    fontWeight: "600",
    fontSize: 12,
    marginTop: 4,
  },
});
