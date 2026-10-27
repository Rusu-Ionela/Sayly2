import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/shared/components/PressableScale";
import type { IconName } from "@/shared/components/SettingRow";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

type EmptyStateCardProps = {
  icon: IconName;
  title: string;
  body: string;
  /** Call to action under the text; the whole card is tappable when set. */
  action?: { label: string; onPress: () => void; icon?: IconName };
};

/** Inviting empty state inside a section card: soft tinted panel, icon, copy and a CTA pill. */
export function EmptyStateCard({ icon, title, body, action }: EmptyStateCardProps) {
  const colors = useColors();

  const content = (
    <>
      <View style={[styles.iconWrap, { backgroundColor: colors.accent }]}>
        <Ionicons name={icon} size={18} color={colors.onPrimary} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.body, { color: colors.muted }]}>{body}</Text>
        {action ? (
          <View style={[styles.cta, { backgroundColor: colors.accent }]}>
            <Ionicons name={action.icon ?? "add"} size={14} color={colors.onPrimary} />
            <Text style={[styles.ctaText, { color: colors.onPrimary }]}>{action.label}</Text>
          </View>
        ) : null}
      </View>
    </>
  );

  const panel = [
    styles.panel,
    { backgroundColor: colors.accentSoft, borderColor: colors.cardBorder },
  ];

  return action ? (
    <PressableScale
      onPress={action.onPress}
      style={panel}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${action.label}`}
    >
      {content}
    </PressableScale>
  ) : (
    <View style={panel}>{content}</View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
  cta: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: "800",
  },
});
