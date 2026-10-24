import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import {
  dateOfBirthBounds,
  formatDateOfBirth,
  parseIsoDate,
  toIsoDate,
} from "@/features/profile/model/dateOfBirth";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

type BirthdayPickerFieldProps = {
  value: string;
  onChange: (isoDate: string) => void;
};

export function BirthdayPickerField({ value, onChange }: BirthdayPickerFieldProps) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const { minimumDate, maximumDate } = dateOfBirthBounds();
  const selected = (value ? parseIsoDate(value) : null) ?? maximumDate;

  const commit = (event: DateTimePickerEvent, next?: Date) => {
    if (Platform.OS === "android") {
      setOpen(false);
    }
    if (event.type === "dismissed" || !next) {
      return;
    }
    onChange(toIsoDate(next));
  };

  const picker = (
    <DateTimePicker
      value={selected}
      mode="date"
      display={Platform.OS === "ios" ? "spinner" : "default"}
      minimumDate={minimumDate}
      maximumDate={maximumDate}
      onChange={commit}
      themeVariant="dark"
      accentColor={colors.primary}
    />
  );

  return (
    <View>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={value ? `Birthday ${formatDateOfBirth(value)}` : "Choose your birthday"}
        style={[styles.field, { borderBottomColor: colors.border }]}
      >
        <Text style={[styles.value, { color: value ? colors.text : colors.placeholder }]}>
          {value ? formatDateOfBirth(value) : "Your birthday"}
        </Text>
      </Pressable>

      {Platform.OS === "ios" ? (
        <Modal
          visible={open}
          transparent
          animationType="slide"
          onRequestClose={() => setOpen(false)}
        >
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHeader}>
              <Pressable
                onPress={() => {
                  onChange(toIsoDate(selected));
                  setOpen(false);
                }}
                accessibilityRole="button"
              >
                <Text style={[styles.done, { color: colors.primary }]}>Done</Text>
              </Pressable>
            </View>
            {open ? picker : null}
          </View>
        </Modal>
      ) : null}

      {Platform.OS !== "ios" && open ? picker : null}
    </View>
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
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: spacing.lg,
  },
  sheetHeader: {
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  done: {
    fontSize: 17,
    fontWeight: "700",
    padding: spacing.sm,
  },
});
