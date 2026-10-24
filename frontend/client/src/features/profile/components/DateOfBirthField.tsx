import { Ionicons } from "@expo/vector-icons";
import RNDateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { memo, useCallback, useMemo, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { useColors, useThemeScheme } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

import {
  dateOfBirthBounds,
  formatDateOfBirth,
  parseIsoDate,
  toIsoDate,
} from "../model/dateOfBirth";

import { TextField } from "@/shared/components/TextField";

type DateOfBirthFieldProps = {
  /** "YYYY-MM-DD" or "" when not set. */
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
};

const LABEL = "Date of birth";

/** Where the calendar opens when nothing is picked yet: a typical adult birth year. */
function initialDate(value: string, maximumDate: Date) {
  return parseIsoDate(value) ?? new Date(maximumDate.getFullYear() - 12, 0, 1);
}

/**
 * Date of birth chosen from the native date picker — never typed. Future dates and
 * ages under 13 cannot be selected; the value is stored as "YYYY-MM-DD".
 */
export const DateOfBirthField = memo(function DateOfBirthField({
  value,
  onChange,
  error,
  hint,
}: DateOfBirthFieldProps) {
  const colors = useColors();
  const scheme = useThemeScheme();
  const bounds = useMemo(() => dateOfBirthBounds(), []);
  const [iosDraft, setIosDraft] = useState<Date | null>(null);

  const open = useCallback(() => {
    const current = initialDate(value, bounds.maximumDate);
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: current,
        mode: "date",
        display: "calendar",
        ...bounds,
        // Fires only when the user confirms (OK); cancelling calls onDismiss instead.
        onValueChange: (_event, date) => onChange(toIsoDate(date)),
      });
      return;
    }
    setIosDraft(current);
  }, [bounds, onChange, value]);

  const confirmIos = useCallback(() => {
    if (iosDraft) {
      onChange(toIsoDate(iosDraft));
    }
    setIosDraft(null);
  }, [iosDraft, onChange]);

  // The native picker does not exist on web: fall back to a validated text field.
  if (Platform.OS === "web") {
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
      <Pressable
        onPress={open}
        style={[
          styles.field,
          { borderColor: error ? colors.rose : colors.cardBorder, backgroundColor: colors.card },
        ]}
        accessibilityRole="button"
        accessibilityLabel={display ? `${LABEL}, ${display}` : `Choose your ${LABEL.toLowerCase()}`}
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
      {hint ? <Text style={[styles.hint, { color: colors.muted }]}>{hint}</Text> : null}
      {error ? <Text style={[styles.error, { color: colors.rose }]}>{error}</Text> : null}

      {Platform.OS === "ios" ? (
        <Modal
          visible={iosDraft !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setIosDraft(null)}
        >
          <View style={styles.overlay}>
            <View style={[styles.sheet, { backgroundColor: colors.card }]}>
              <View style={styles.sheetHeader}>
                <Pressable
                  onPress={() => setIosDraft(null)}
                  hitSlop={12}
                  accessibilityRole="button"
                >
                  <Text style={[styles.sheetAction, { color: colors.muted }]}>Cancel</Text>
                </Pressable>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>{LABEL}</Text>
                <Pressable onPress={confirmIos} hitSlop={12} accessibilityRole="button">
                  <Text style={[styles.sheetAction, styles.done, { color: colors.accent }]}>
                    Done
                  </Text>
                </Pressable>
              </View>
              {iosDraft ? (
                <RNDateTimePicker
                  value={iosDraft}
                  mode="date"
                  display="spinner"
                  themeVariant={scheme === "dark" ? "dark" : "light"}
                  {...bounds}
                  onValueChange={(_event, date) => setIosDraft(date)}
                />
              ) : null}
            </View>
          </View>
        </Modal>
      ) : null}
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
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  sheetAction: {
    fontSize: 16,
    fontWeight: "600",
  },
  done: {
    fontWeight: "800",
  },
});
