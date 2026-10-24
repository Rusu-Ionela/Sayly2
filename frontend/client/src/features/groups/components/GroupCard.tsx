import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/shared/components/PressableScale";
import { useColors } from "@/shared/theme";

import type { GroupSummary } from "../types";

type GroupCardProps = {
  group: GroupSummary;
  onPress: (groupId: string) => void;
};

function GroupCardComponent({ group, onPress }: GroupCardProps) {
  const colors = useColors();

  return (
    <PressableScale
      onPress={() => onPress(group.id)}
      style={[styles.card, { backgroundColor: colors.card }]}
      accessibilityRole="button"
      accessibilityLabel={`${group.name}. ${group.language.name} club, ${group.memberCount} members${
        group.unreadCount > 0 ? `. ${group.unreadCount} unread` : ""
      }`}
    >
      <View style={[styles.header, { backgroundColor: colors.border }]}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {group.name}
        </Text>
        {group.visibility === "PRIVATE" ? (
          <Ionicons name="lock-closed" size={14} color={colors.muted} />
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={[styles.language, { color: colors.text }]}>
          {group.language.flagEmoji || "🌐"} {group.language.name}
        </Text>
        {group.description ? (
          <Text style={[styles.description, { color: colors.muted }]} numberOfLines={3}>
            {group.description}
          </Text>
        ) : null}
        <View style={styles.footer}>
          {group.unreadCount > 0 ? (
            <View style={[styles.unread, { backgroundColor: colors.accent }]}>
              <Text style={[styles.unreadText, { color: colors.onPrimary }]}>
                {group.unreadCount > 99 ? "99+" : group.unreadCount}
              </Text>
            </View>
          ) : (
            <View />
          )}
          <View style={styles.members}>
            <Ionicons name="people" size={18} color={colors.muted} />
            <Text style={[styles.membersText, { color: colors.muted }]}>{group.memberCount}</Text>
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

export const GroupCard = memo(GroupCardComponent);

const styles = StyleSheet.create({
  card: { borderRadius: 16, overflow: "hidden", marginBottom: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  name: { flex: 1, fontSize: 17, fontWeight: "600" },
  body: { padding: 16, gap: 10 },
  language: { fontSize: 16, fontWeight: "500" },
  description: { fontSize: 15, lineHeight: 21 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  members: { flexDirection: "row", alignItems: "center", gap: 6 },
  membersText: { fontSize: 15, fontWeight: "500" },
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
