import { Pressable, StyleSheet, Text, TextInput } from "react-native";

import {
  DateOfBirthPicker,
  NATIVE_DATE_PICKER,
} from "@/features/profile/components/DateOfBirthPicker";
import { formatDateOfBirth } from "@/features/profile/model/dateOfBirth";
import { useColors } from "@/shared/theme";

type BirthdayPickerFieldProps = {
  value: string;
  onChange: (isoDate: string) => void;
};

/** Onboarding's underlined birthday field; the picker itself is the shared DateOfBirthPicker. */
export function BirthdayPickerField({ value, onChange }: BirthdayPickerFieldProps) {
  const colors = useColors();
  const fieldStyle = [styles.field, { borderBottomColor: colors.border }];

  if (!NATIVE_DATE_PICKER) {
    return (
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Your birthday (YYYY-MM-DD)"
        placeholderTextColor={colors.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Birthday"
        style={[fieldStyle, styles.value, { color: colors.text }]}
      />
    );
  }

  return (
    <DateOfBirthPicker value={value} onChange={onChange} title="Your birthday">
      {(open) => (
        <Pressable
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={
            value ? `Birthday ${formatDateOfBirth(value)}` : "Choose your birthday"
          }
          style={fieldStyle}
        >
          <Text style={[styles.value, { color: value ? colors.text : colors.placeholder }]}>
            {value ? formatDateOfBirth(value) : "Your birthday"}
          </Text>
        </Pressable>
      )}
    </DateOfBirthPicker>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 52,
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  value: {
    fontSize: 18,
    fontWeight: "500",
  },
});
