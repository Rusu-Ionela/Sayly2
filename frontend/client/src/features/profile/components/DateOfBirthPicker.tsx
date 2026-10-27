import RNDateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { useColors, useThemeScheme } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

import { dateOfBirthBounds, parseIsoDate, toIsoDate } from "../model/dateOfBirth";

/** False on web, where the native picker does not exist; fields show a text input there. */
export const NATIVE_DATE_PICKER = Platform.OS !== "web";

type DateOfBirthPickerProps = {
  /** "YYYY-MM-DD" or "" when not set. */
  value: string;
  onChange: (value: string) => void;
  /** Title of the iOS sheet. */
  title?: string;
  /** The tappable field; call `open` to show the picker. */
  children: (open: () => void) => ReactNode;
};

/** Where the calendar opens when nothing is picked yet: a typical adult birth year. */
function initialDate(value: string, maximumDate: Date) {
  return parseIsoDate(value) ?? new Date(maximumDate.getFullYear() - 12, 0, 1);
}

/**
 * The one date-of-birth picker: Android's calendar dialog, or an iOS sheet with Cancel / Done
 * (nothing changes until Done). Only adult ages can be picked; the value is "YYYY-MM-DD".
 */
export function DateOfBirthPicker({
  value,
  onChange,
  title = "Date of birth",
  children,
}: DateOfBirthPickerProps) {
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

  return (
    <>
      {children(open)}
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
                <Text style={[styles.sheetTitle, { color: colors.text }]}>{title}</Text>
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
    </>
  );
}

const styles = StyleSheet.create({
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
