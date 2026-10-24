import { Alert } from "react-native";

type ConfirmActionOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
};

/** Shared destructive-action confirmation (leave, remove, delete…). */
export function confirmAction({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Keep",
  onConfirm,
}: ConfirmActionOptions) {
  Alert.alert(title, message, [
    { text: cancelLabel, style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm },
  ]);
}
