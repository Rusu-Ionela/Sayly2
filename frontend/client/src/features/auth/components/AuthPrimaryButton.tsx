import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from "react-native";

type AuthPrimaryButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export function AuthPrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
}: AuthPrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.button, isDisabled && styles.buttonDisabled]}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isDisabled }}
    >
      {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.label}>{label}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#4F46E5",
    borderRadius: 14,
    paddingVertical: 16,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: "#FFFFFF",
  },
});
