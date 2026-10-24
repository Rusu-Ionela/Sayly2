import { Ionicons } from "@expo/vector-icons";
import { memo, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Switch, Text, View } from "react-native";

import { PressableScale } from "@/shared/components/PressableScale";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

export type IconName = keyof typeof Ionicons.glyphMap;

type BaseProps = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  /** "danger" for destructive actions (sign out, delete account). */
  tone?: "default" | "danger";
  disabled?: boolean;
};

type LinkProps = BaseProps & {
  kind: "link";
  onPress: () => void;
  /** Right side: a short value ("Dark") or a custom node (badge). Chevron otherwise. */
  value?: string;
  trailing?: ReactNode;
  loading?: boolean;
};

type ToggleProps = BaseProps & {
  kind: "toggle";
  value: boolean;
  onValueChange: (next: boolean) => void;
};

export type SettingRowProps = LinkProps | ToggleProps;

/**
 * The one list row used by Profile and Settings: navigation/action rows and switches.
 * Dividers and grouping come from `SectionCard`.
 */
export const SettingRow = memo(function SettingRow(props: SettingRowProps) {
  const colors = useColors();
  const { title, subtitle, icon, tone = "default", disabled } = props;
  const titleColor = tone === "danger" ? colors.rose : colors.text;
  const isToggle = props.kind === "toggle";

  const onPress = isToggle ? () => props.onValueChange(!props.value) : props.onPress;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || (!isToggle && props.loading)}
      style={[styles.row, disabled && styles.disabled]}
      accessibilityRole={isToggle ? "switch" : "button"}
      accessibilityState={isToggle ? { checked: props.value, disabled } : { disabled }}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
    >
      {icon ? (
        <View style={styles.icon}>
          <Ionicons name={icon} size={22} color={tone === "danger" ? colors.rose : colors.accent} />
        </View>
      ) : null}

      <View style={styles.copy}>
        <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.muted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {isToggle ? (
        <Switch
          value={props.value}
          onValueChange={props.onValueChange}
          disabled={disabled}
          trackColor={{ false: colors.border, true: colors.accentSoft }}
          thumbColor={props.value ? colors.accent : colors.muted}
          // The row already announces itself as a switch.
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        />
      ) : props.loading ? (
        <ActivityIndicator color={titleColor} />
      ) : (
        (props.trailing ??
        (props.value ? (
          <Text style={[styles.value, { color: colors.muted }]}>{props.value}</Text>
        ) : (
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        )))
      )}
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  disabled: {
    opacity: 0.5,
  },
  icon: {
    width: 28,
    alignItems: "center",
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  value: {
    fontSize: 15,
  },
});
