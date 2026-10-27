import { Ionicons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  View,
} from "react-native";
import { KeyboardSafeView } from "@/shared/components/KeyboardSafeView";

import { useAuth } from "@/features/auth";
import { useChangePassword } from "@/features/safety";
import { isApiError } from "@/lib/api/errors";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

import { passwordFormState, type PasswordFields } from "../model/changePassword";

type Field = keyof PasswordFields;

const FIELDS: { key: Field; label: string; hint?: string }[] = [
  { key: "current", label: "Current password" },
  {
    key: "next",
    label: "New password",
    hint: "At least 8 characters, with a letter and a number.",
  },
  { key: "confirm", label: "Confirm new password" },
];

const EMPTY: PasswordFields = { current: "", next: "", confirm: "" };

type ChangePasswordSheetProps = {
  visible: boolean;
  onClose: () => void;
};

/**
 * Bottom sheet for changing the password; the server then ends every session. It rises
 * above the keyboard and validates as you type (rules, "Passwords do not match").
 */
export function ChangePasswordSheet({ visible, onClose }: ChangePasswordSheetProps) {
  const colors = useColors();
  const { signOut } = useAuth();
  const changePassword = useChangePassword();
  const [values, setValues] = useState(EMPTY);
  const [currentError, setCurrentError] = useState<string>();
  const inputs = useRef<Partial<Record<Field, TextInputInstance | null>>>({});

  const form = passwordFormState(values);
  const errors: Partial<Record<Field, string>> = {
    current: currentError,
    next: form.nextError,
    confirm: form.confirmError,
  };

  const close = () => {
    setValues(EMPTY);
    setCurrentError(undefined);
    changePassword.reset();
    onClose();
  };

  const setField = (key: Field, text: string) => {
    setValues((current) => ({ ...current, [key]: text }));
    if (key === "current") setCurrentError(undefined);
  };

  const submit = () => {
    if (!form.canSubmit || changePassword.isPending) return;

    changePassword.mutate(
      { currentPassword: values.current, newPassword: values.next },
      {
        onSuccess: () => {
          close();
          Alert.alert("Password updated", "Please sign in again with your new password.", [
            { text: "OK", onPress: () => void signOut() },
          ]);
        },
        onError: (error) => {
          // 400 = the server rejected the current password: show it under that field.
          if (isApiError(error) && error.isValidation) {
            setCurrentError(error.message || "Current password is incorrect.");
            inputs.current.current?.focus();
            return;
          }
          Alert.alert(
            "Could not change password",
            isApiError(error) && error.isNetwork
              ? "You're offline. Check your connection and try again."
              : isApiError(error) && error.isRateLimited
                ? "Too many attempts. Please wait a moment and try again."
                : "Something went wrong. Please try again.",
          );
        },
      },
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardSafeView style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            <Text style={[styles.title, { color: colors.text }]}>Change password</Text>

            {FIELDS.map((field, index) => {
              const error = errors[field.key];
              const isLast = index === FIELDS.length - 1;
              const confirmed = field.key === "confirm" && form.matches;
              return (
                <View key={field.key} style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>{field.label}</Text>
                  <View>
                    <TextInput
                      ref={(input) => {
                        inputs.current[field.key] = input;
                      }}
                      value={values[field.key]}
                      onChangeText={(text) => setField(field.key, text)}
                      placeholder={field.label}
                      placeholderTextColor={colors.placeholder}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType={field.key === "current" ? "password" : "newPassword"}
                      returnKeyType={isLast ? "done" : "next"}
                      submitBehavior={isLast ? "blurAndSubmit" : "submit"}
                      onSubmitEditing={() =>
                        isLast ? submit() : inputs.current[FIELDS[index + 1]!.key]?.focus()
                      }
                      accessibilityLabel={field.label}
                      accessibilityHint={error}
                      style={[
                        styles.input,
                        {
                          borderColor: error
                            ? colors.rose
                            : confirmed
                              ? colors.presence
                              : colors.cardBorder,
                          backgroundColor: colors.card,
                          color: colors.text,
                        },
                      ]}
                    />
                    {confirmed ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={colors.presence}
                        style={styles.check}
                        accessibilityLabel="Passwords match"
                      />
                    ) : null}
                  </View>
                  {error ? (
                    <Text
                      style={[styles.error, { color: colors.rose }]}
                      accessibilityLiveRegion="polite"
                    >
                      {error}
                    </Text>
                  ) : field.hint ? (
                    <Text style={[styles.hint, { color: colors.muted }]}>{field.hint}</Text>
                  ) : null}
                </View>
              );
            })}

            <View style={styles.actions}>
              <Pressable
                style={[styles.button, styles.secondary, { backgroundColor: colors.card }]}
                onPress={close}
                accessibilityRole="button"
              >
                <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.button,
                  styles.primary,
                  { backgroundColor: colors.accent },
                  !form.canSubmit && styles.disabled,
                ]}
                onPress={submit}
                disabled={!form.canSubmit || changePassword.isPending}
                accessibilityRole="button"
                accessibilityState={{ disabled: !form.canSubmit || changePassword.isPending }}
              >
                {changePassword.isPending ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Save</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardSafeView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: spacing.xs,
  },
  field: {
    gap: 6,
  },
  label: {
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingRight: 44,
    paddingVertical: 14,
    minHeight: 54,
  },
  check: {
    position: "absolute",
    right: 14,
    top: 17,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
  },
  error: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  button: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: {
    flex: 1,
  },
  primary: {
    flex: 1.2,
  },
  disabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontWeight: "800",
  },
});
