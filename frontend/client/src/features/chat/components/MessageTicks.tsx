import { Ionicons } from "@expo/vector-icons";

import { useColors } from "@/shared/theme";

import type { ChatMessage } from "../types";

type MessageTicksProps = {
  message: ChatMessage;
  compact?: boolean;
};

export function MessageTicks({ message, compact = false }: MessageTicksProps) {
  const colors = useColors();
  const size = compact ? 14 : 15;

  if (message.localState === "sending") {
    return (
      <Ionicons name="time-outline" size={size} color={colors.muted} accessibilityLabel="Sending" />
    );
  }

  if (message.localState === "failed") {
    return (
      <Ionicons
        name="alert-circle"
        size={size}
        color={colors.rose}
        accessibilityLabel="Failed to send"
      />
    );
  }

  if (message.status === "READ") {
    return (
      <Ionicons name="checkmark-done" size={size} color={colors.accent} accessibilityLabel="Read" />
    );
  }

  if (message.status === "DELIVERED") {
    return (
      <Ionicons
        name="checkmark-done"
        size={size}
        color={colors.muted}
        accessibilityLabel="Delivered"
      />
    );
  }

  return <Ionicons name="checkmark" size={size} color={colors.muted} accessibilityLabel="Sent" />;
}
