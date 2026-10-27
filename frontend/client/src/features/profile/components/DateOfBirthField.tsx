import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { TextField } from "@/shared/components/TextField";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

import { formatDateOfBirth } from "../model/dateOfBirth";

import { DateOfBirthPicker, NATIVE_DATE_PICKER } from "./DateOfBirthPicker";

type DateOfBirthFieldProps = {
  /** "YYYY-MM-DD" or "" when not set. */
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
};

const LABEL = "Date of birth";

/** Labelled form field (edit profile). The date is picked from the calendar, never typed. */
export const DateOfBirthField = memo(function DateOfBirthField({
  value,
  onChange,
  error,
  hint,
}: DateOfBirthFieldProps) {
  const colors = useColors();

  if (!NATIVE_DATE_PICKER) {
    return (
      <TextField
        label={LABEL}
        value={value}
        onChangeText={onChange}
        error={error}
        hint={hint}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
        autoCorrect={false}
      />
    );
  }

  const display = formatDateOfBirth(value);

  return (
    <View>
      <Text style={[styles.label, { color: colors.text }]}>{LABEL}</Text>
      <DateOfBirthPicker value={value} onChange={onChange} title={LABEL}>
        {(open) => (
          <Pressable
            onPress={open}
            style={[
              styles.field,
              {
                borderColor: error ? colors.rose : colors.cardBorder,
                backgroundColor: colors.card,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              display ? `${LABEL}, ${display}` : `Choose your ${LABEL.toLowerCase()}`
            }
          >
            <Ionicons name="calendar-outline" size={20} color={colors.accent} />
            <Text
              style={[
                styles.value,
                { color: display ? colors.text : colors.muted },
                !display && styles.placeholder,
              ]}
            >
              {display || "Choose from calendar"}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        )}
      </DateOfBirthPicker>
      {hint ? <Text style={[styles.hint, { color: colors.muted }]}>{hint}</Text> : null}
      {error ? <Text style={[styles.error, { color: colors.rose }]}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  label: {
    fontWeight: "700",
    marginTop: spacing.sm,
    marginBottom: 6,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    minHeight: 54,
  },
  value: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  placeholder: {
    fontWeight: "500",
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
