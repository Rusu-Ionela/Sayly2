import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/shared/components/PressableScale";
import { useColors } from "@/shared/theme";

import { groupActivity } from "../model/groupModel";
import type { GroupSummary } from "../types";
import { GroupAvatar, LiveBadge } from "./GroupBadges";

type GroupCardProps = {
  group: GroupSummary;
  onPress: (groupId: string) => void;
};

function GroupCardComponent({ group, onPress }: GroupCardProps) {
  const colors = useColors();
  const activity = groupActivity(group.lastActivityAt);

  return (
    <PressableScale
      onPress={() => onPress(group.id)}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
      accessibilityRole="button"
      accessibilityLabel={`${group.name}. ${group.language.name} club, ${group.memberCount} members${
        activity ? `. ${activity.label}` : ""
      }${group.unreadCount > 0 ? `. ${group.unreadCount} unread` : ""}`}
    >
      <View style={styles.header}>
        <GroupAvatar flag={group.language.flagEmoji} size={48} />
        <View style={styles.titleCol}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {group.name}
            </Text>
            {group.visibility === "PRIVATE" ? (
              <Ionicons name="lock-closed" size={14} color={colors.muted} />
            ) : null}
          </View>
          <Text style={[styles.language, { color: colors.muted }]} numberOfLines={1}>
            {group.language.name} club
          </Text>
        </View>
        {activity?.live ? <LiveBadge /> : null}
      </View>

      {group.description ? (
        <Text style={[styles.description, { color: colors.muted }]} numberOfLines={2}>
          {group.description}
        </Text>
      ) : null}

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <View style={styles.meta}>
          <Ionicons name="people" size={16} color={colors.muted} />
          <Text style={[styles.metaText, { color: colors.muted }]}>
            {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
          </Text>
          {activity && !activity.live ? (
            <Text style={[styles.metaText, { color: colors.muted }]} numberOfLines={1}>
              · {activity.label}
            </Text>
          ) : null}
        </View>
        {group.unreadCount > 0 ? (
          <View style={[styles.unread, { backgroundColor: colors.accent }]}>
            <Text style={[styles.unreadText, { color: colors.onPrimary }]}>
              {group.unreadCount > 99 ? "99+" : group.unreadCount}
            </Text>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}

export const GroupCard = memo(GroupCardComponent);

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 18, gap: 14, marginBottom: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  titleCol: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flexShrink: 1, fontSize: 17, fontWeight: "700" },
  language: { fontSize: 13, fontWeight: "500" },
  description: { fontSize: 15, lineHeight: 21 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  meta: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontSize: 13, fontWeight: "600" },
  unread: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadText: { fontSize: 12, fontWeight: "700" },
});
