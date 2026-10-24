import { memo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/shared/components/Avatar";
import { PressableScale } from "@/shared/components/PressableScale";
import { ProBadge } from "@/shared/components/ProBadge";
import { useColors } from "@/shared/theme";
import type { MemberSummary } from "@/shared/types/member";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";
import { relativeTime } from "@/shared/utils/relativeTime";

type MemberRowProps = {
  member: MemberSummary;
  onPress: () => void;
  /** Overrides the activity line (e.g. "Viewed 2 days ago"). */
  caption?: string;
  /** Right side (e.g. a Follow button). */
  trailing?: ReactNode;
  /** Highlights the row (new visitor). */
  highlighted?: boolean;
};

function activityLine(member: MemberSummary) {
  if (member.onlineStatus === "ONLINE") return "Online now";
  if (member.onlineStatus === "OFFLINE" && member.lastSeen) {
    return `Active ${relativeTime(member.lastSeen)}`;
  }
  return null;
}

/** One member in a list: avatar with presence dot, name, languages and activity. */
export const MemberRow = memo(function MemberRow({
  member,
  onPress,
  caption,
  trailing,
  highlighted,
}: MemberRowProps) {
  const colors = useColors();
  const online = member.onlineStatus === "ONLINE";
  const location = [member.city, member.country].filter(Boolean).join(", ");
  const languages = [
    member.nativeLanguage
      ? `${member.nativeLanguage.flagEmoji} ${member.nativeLanguage.name}`
      : null,
    member.learningLanguage
      ? `→ ${member.learningLanguage.flagEmoji} ${member.learningLanguage.name}`
      : null,
  ]
    .filter(Boolean)
    .join("  ");
  const detail = caption ?? activityLine(member);

  return (
    <PressableScale
      onPress={onPress}
      style={[
        styles.row,
        {
          backgroundColor: highlighted ? colors.accentSoft : colors.card,
          borderColor: colors.cardBorder,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={[member.displayName, online ? "online" : null, detail]
        .filter(Boolean)
        .join(", ")}
    >
      <View>
        <Avatar uri={member.avatarUrl} name={member.displayName} size={52} />
        {online ? (
          <View
            style={[styles.dot, { backgroundColor: colors.presence, borderColor: colors.card }]}
          />
        ) : null}
      </View>

      <View style={styles.copy}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {member.displayName}
          </Text>
          {member.isPro ? <ProBadge /> : null}
        </View>
        {languages ? (
          <Text style={[styles.meta, { color: colors.label }]} numberOfLines={1}>
            {languages}
          </Text>
        ) : null}
        {detail || location ? (
          <Text style={[styles.meta, { color: colors.muted }]} numberOfLines={1}>
            {[detail, location].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
      </View>

      {trailing}
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  dot: {
    position: "absolute",
    right: 1,
    bottom: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    flexShrink: 1,
  },
  meta: {
    fontSize: 13,
  },
});
