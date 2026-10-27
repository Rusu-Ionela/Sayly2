import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { formatChatTime } from "@/features/chat/utils/formatChatTime";
import { AppRefreshControl } from "@/shared/components/AppRefreshControl";
import { Avatar } from "@/shared/components/Avatar";
import { PressableScale } from "@/shared/components/PressableScale";
import { Screen } from "@/shared/components/Screen";
import { Skeleton } from "@/shared/components/Skeleton";
import { WarmEmptyState } from "@/shared/components/WarmEmptyState";
import { WarmErrorState } from "@/shared/components/WarmErrorState";
import { useColors } from "@/shared/theme";

import { inboxRow } from "./inboxView";
import { openNotificationTarget } from "./openTarget";
import { useInbox, useMarkRead } from "./useInbox";

export function NotificationsScreen() {
  const colors = useColors();
  const inbox = useInbox();
  const markRead = useMarkRead();
  const items = useMemo(() => inbox.data?.pages.flatMap((page) => page.items) ?? [], [inbox.data]);
  const hasUnread = items.some((item) => !item.readAt);

  if (inbox.isPending) {
    return (
      <Screen includeBottomInset>
        <View accessibilityLabel="Loading" accessibilityRole="progressbar">
          {[0, 1, 2, 3, 4].map((key) => (
            <View key={key} style={styles.row}>
              <Skeleton width={48} height={48} radius={24} />
              <View style={styles.copy}>
                <Skeleton width="70%" height={14} />
                <Skeleton width="25%" height={12} />
              </View>
            </View>
          ))}
        </View>
      </Screen>
    );
  }

  if (inbox.isError) {
    return (
      <Screen includeBottomInset>
        <WarmErrorState
          title="Could not load notifications"
          body="Check your connection and try again."
          onAction={() => void inbox.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen includeBottomInset>
      {hasUnread ? (
        <PressableScale
          onPress={() => markRead.mutate(undefined)}
          style={styles.markAll}
          accessibilityRole="button"
          accessibilityLabel="Mark all notifications as read"
        >
          <Text style={[styles.markAllText, { color: colors.accent }]}>Mark all as read</Text>
        </PressableScale>
      ) : null}
      <FlashList
        data={items}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (inbox.hasNextPage && !inbox.isFetchingNextPage) void inbox.fetchNextPage();
        }}
        refreshControl={
          <AppRefreshControl
            refreshing={inbox.isRefetching && !inbox.isFetchingNextPage}
            onRefresh={() => void inbox.refetch()}
          />
        }
        ListEmptyComponent={
          <WarmEmptyState
            title="Nothing new yet"
            body="Corrections and references will show up here."
          />
        }
        renderItem={({ item }) => {
          const row = inboxRow(item);
          const unread = !item.readAt;
          return (
            <PressableScale
              onPress={() => {
                if (unread) markRead.mutate(item.id);
                openNotificationTarget(row.target);
              }}
              style={[styles.row, { borderBottomColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={`${row.text}${unread ? ", unread" : ""}`}
            >
              <Avatar uri={item.actor.avatarUrl} name={item.actor.displayName} size={48} />
              <View style={styles.copy}>
                <Text
                  style={[styles.text, { color: colors.text, fontWeight: unread ? "700" : "400" }]}
                  numberOfLines={2}
                >
                  {row.text}
                </Text>
                <Text style={{ color: colors.muted }}>{formatChatTime(item.createdAt)}</Text>
              </View>
              <Ionicons name={row.icon} size={20} color={colors.muted} />
              {unread ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : null}
            </PressableScale>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  copy: { flex: 1, gap: 4 },
  text: { fontSize: 16 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  markAll: { alignSelf: "flex-end", paddingVertical: 8, minHeight: 44, justifyContent: "center" },
  markAllText: { fontSize: 15, fontWeight: "600" },
});
