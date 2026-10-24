import { type ReactNode } from "react";
import { StyleSheet, Text } from "react-native";

import { PressableScale } from "@/shared/components/PressableScale";
import { WarmEmptyState } from "@/shared/components/WarmEmptyState";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

type WarmErrorStateProps = {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: ReactNode;
};

/** Shared error + retry surface (wraps WarmEmptyState). */
export function WarmErrorState({
  title,
  body,
  actionLabel = "Try again",
  onAction,
  action,
}: WarmErrorStateProps) {
  const colors = useColors();

  return (
    <WarmEmptyState
      title={title}
      body={body}
      action={
        action ??
        (onAction ? (
          <PressableScale
            onPress={onAction}
            style={[styles.action, { backgroundColor: colors.accentSoft }]}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
          >
            <Text style={[styles.actionText, { color: colors.accent }]}>{actionLabel}</Text>
          </PressableScale>
        ) : null)
      }
    />
  );
}

const styles = StyleSheet.create({
  action: {
    marginTop: spacing.sm,
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.pill,
    justifyContent: "center",
  },
  actionText: {
    fontWeight: "700",
    fontSize: 15,
  },
});
