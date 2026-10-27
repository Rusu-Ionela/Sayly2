import { FlashList } from "@shopify/flash-list";
import { useCallback, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useAuth } from "@/features/auth";
import { useProfile } from "@/features/profile/hooks/useProfile";
import { StoryBar } from "@/features/stories";
import { Avatar } from "@/shared/components/Avatar";
import { AppRefreshControl } from "@/shared/components/AppRefreshControl";
import { Screen } from "@/shared/components/Screen";
import { Chip } from "@/shared/components/Chip";
import { SearchField } from "@/shared/components/SearchField";
import { WarmEmptyState } from "@/shared/components/WarmEmptyState";
import { WarmErrorState } from "@/shared/components/WarmErrorState";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";
import { getTypography } from "@/shared/theme/typography";
import type { AppStackParamList } from "@/navigation/types";
import { useFloatingTabBarPadding } from "@/navigation/floatingTabBar";

import { ChatListItem } from "../components/ChatListItem";
import { ChatListSkeleton } from "../components/ChatListSkeleton";
import { useConversations } from "../hooks/useConversations";
import { usePinConversation } from "../hooks/usePinConversation";
import type { Conversation } from "../types";

export function ChatsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const profile = useProfile();
  const colors = useColors();
  const type = getTypography(colors);
  const tabBarPadding = useFloatingTabBarPadding();
  const { userId } = useAuth();
  const conversations = useConversations();
  const pin = usePinConversation();
  const needle = search.trim().toLowerCase();
  // shortcut: filters loaded pages only; add server-side search if users exceed a few hundred chats.
  const visible = useMemo(
    () =>
      (conversations.data ?? []).filter(
        (item) =>
          (!unreadOnly || item.unreadCount > 0) &&
          (!needle || item.otherUser.displayName.toLowerCase().includes(needle)),
      ),
    [conversations.data, needle, unreadOnly],
  );
  const goToCommunity = () => navigation.navigate("MainTabs", { screen: "Community" });

  const openChat = useCallback(
    (conversationId: string) => {
      navigation.navigate("Conversation", { conversationId });
    },
    [navigation],
  );

  const offerPin = useCallback(
    (item: Conversation) => {
      const pinned = Boolean(item.pinnedAt);
      Alert.alert(item.otherUser.displayName, undefined, [
        {
          text: pinned ? "Unpin chat" : "Pin chat",
          onPress: () => pin.mutate({ conversationId: item.id, pinned: !pinned }),
        },
        { text: "Cancel", style: "cancel" },
      ]);
    },
    [pin],
  );

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => (
      <ChatListItem
        conversation={item}
        viewerId={userId}
        onPress={() => openChat(item.id)}
        onLongPress={() => offerPin(item)}
      />
    ),
    [offerPin, openChat, userId],
  );

  return (
    <Screen>
      <View style={styles.header}>
        <Avatar
          uri={profile.data?.avatarUrl ?? profile.data?.profileImageUrl ?? profile.data?.photoUrl}
          name={profile.data?.displayName}
          size={40}
        />
        <Text style={[type.screenTitle, styles.title]}>Chats</Text>
        <Pressable
          onPress={() => {
            setSearching((open) => !open);
            setSearch("");
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Search chats"
        >
          <Ionicons name="search" size={24} color={colors.muted} />
        </Pressable>
      </View>
      <StoryBar />
      <View style={styles.filters}>
        <Chip label="All" selected={!unreadOnly} onPress={() => setUnreadOnly(false)} />
        <Chip label="Unread" selected={unreadOnly} onPress={() => setUnreadOnly(true)} />
      </View>
      {searching ? (
        <View style={styles.search}>
          <SearchField
            value={search}
            onChange={setSearch}
            onClear={() => setSearch("")}
            placeholder="Search chats"
            accessibilityLabel="Search chats by name"
          />
        </View>
      ) : null}

      {conversations.isLoading ? (
        <ChatListSkeleton />
      ) : conversations.isError ? (
        <WarmErrorState
          title="Could not load chats"
          body="Check your connection and try again."
          onAction={() => void conversations.refetch()}
        />
      ) : (
        <FlashList
          showsVerticalScrollIndicator={false}
          data={visible}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            needle || unreadOnly ? (
              <WarmEmptyState
                title={needle ? "No chats match" : "No unread chats"}
                body={
                  needle
                    ? `Nobody named "${search.trim()}" in your chats.`
                    : "You're all caught up."
                }
              />
            ) : (
              <WarmEmptyState
                title="No chats yet"
                body="Open a profile in Community and tap Message to start your first conversation."
                action={
                  <Chip label="Find partners" icon="earth" selected onPress={goToCommunity} />
                }
              />
            )
          }
          contentContainerStyle={[styles.list, { paddingBottom: tabBarPadding }]}
          refreshControl={
            <AppRefreshControl
              refreshing={conversations.isRefetching && !conversations.isLoading}
              onRefresh={() => void conversations.refetch()}
            />
          }
          onEndReachedThreshold={0.35}
          onEndReached={() => {
            if (conversations.hasNextPage && !conversations.isFetchingNextPage) {
              void conversations.fetchNextPage();
            }
          }}
          ListFooterComponent={
            conversations.isFetchingNextPage ? (
              <Text style={[styles.footer, { color: colors.muted }]}>Loading more…</Text>
            ) : undefined
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  title: { flex: 1, fontSize: 20, letterSpacing: 0 },
  filters: { flexDirection: "row", gap: 8, marginVertical: spacing.md },
  list: {
    flexGrow: 1,
  },
  search: {
    flexDirection: "row",
    marginBottom: spacing.md,
  },
  footer: {
    textAlign: "center",
    paddingVertical: spacing.md,
    fontWeight: "600",
  },
});
