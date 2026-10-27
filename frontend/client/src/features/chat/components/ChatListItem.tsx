import { memo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/shared/components/Avatar";
import { PressableScale } from "@/shared/components/PressableScale";
import { useColors } from "@/shared/theme";

import { CHAT_LIST_AVATAR_SIZE, CHAT_LIST_ROW_HEIGHT } from "../constants";
import type { Conversation } from "../types";
import { formatChatTime } from "../utils/formatChatTime";
import { lastMessagePreview } from "../utils/messagePreview";
import { MessageTicks } from "./MessageTicks";

type ChatListItemProps = {
  conversation: Conversation;
  viewerId?: string | null;
  onPress: () => void;
  onLongPress?: () => void;
};

function ChatListItemComponent({
  conversation,
  viewerId,
  onPress,
  onLongPress,
}: ChatListItemProps) {
  const colors = useColors();
  const unread = conversation.unreadCount > 0;
  const last = conversation.lastMessage;
  const mine = Boolean(last && viewerId && last.senderId === viewerId);
  const snippet = lastMessagePreview(last, {
    id: viewerId,
    partnerName: conversation.otherUser.displayName,
  });
  const time = formatChatTime(last?.createdAt ?? conversation.updatedAt);

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.item, { borderBottomColor: colors.border, height: CHAT_LIST_ROW_HEIGHT }]}
      accessibilityRole="button"
      accessibilityLabel={`${conversation.pinnedAt ? "Pinned, " : ""}${conversation.otherUser.displayName}, ${snippet}, ${time}`}
      accessibilityHint="Long press to pin or unpin"
    >
      <Avatar
        uri={conversation.otherUser.avatarUrl ?? conversation.otherUser.photoUrl}
        name={conversation.otherUser.displayName}
        size={CHAT_LIST_AVATAR_SIZE}
      />
      <View style={styles.body}>
        <View style={styles.top}>
          <Text
            style={[styles.name, { color: colors.text }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {conversation.otherUser.displayName}
          </Text>
          <View style={styles.meta}>
            {conversation.pinnedAt ? <Ionicons name="pin" size={13} color={colors.muted} /> : null}
            <Text style={[styles.time, { color: unread ? colors.accent : colors.muted }]}>
              {time}
            </Text>
          </View>
        </View>
        <View style={styles.previewRow}>
          <Text
            style={[
              styles.preview,
              unread && styles.previewUnread,
              { color: unread ? colors.text : colors.muted },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {mine ? "You: " : ""}
            {snippet}
          </Text>
          {unread ? (
            <View style={[styles.dot, { backgroundColor: colors.accent }]}>
              <Text style={[styles.dotText, { color: colors.onPrimary }]}>
                {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
              </Text>
            </View>
          ) : mine && last ? (
            <MessageTicks message={last} compact />
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}

export const ChatListItem = memo(ChatListItemComponent);

const styles = StyleSheet.create({
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: { flex: 1, minWidth: 0, gap: 2 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  name: { flex: 1, fontWeight: "600", fontSize: 17 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  time: { fontSize: 13 },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  preview: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 20 },
  previewUnread: { fontWeight: "600" },
  dot: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  dotText: { fontSize: 11, fontWeight: "700" },
});
