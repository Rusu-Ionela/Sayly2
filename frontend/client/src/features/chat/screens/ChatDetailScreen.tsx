import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardSafeView } from "@/shared/components/KeyboardSafeView";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useAuth } from "@/features/auth";
import { useCallUser } from "@/features/calls/hooks/useCallUser";
import { BlockReportMenu } from "@/features/safety";
import { AppRefreshControl } from "@/shared/components/AppRefreshControl";
import { Avatar } from "@/shared/components/Avatar";
import { Screen } from "@/shared/components/Screen";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";
import type { AppStackParamList } from "@/navigation/types";

import { ChatInput } from "../components/ChatInput";
import { MessageBubble } from "../components/MessageBubble";
import { SystemNotice } from "../components/SystemNotice";
import { TypingIndicator } from "../components/TypingIndicator";
import { useAutoTranslateIncoming, useSetAutoTranslate } from "../hooks/useAutoTranslate";
import { useConversations } from "../hooks/useConversations";
import { useMessages } from "../hooks/useMessages";
import { useSocketContext } from "../socket/SocketProvider";
import type { ChatMediaDraft, ChatMessage } from "../types";
import { systemNoticeText } from "../utils/systemNotice";
import { CHAT_LIST_MVCP } from "../constants";

export function ChatDetailScreen() {
  const route = useRoute<RouteProp<AppStackParamList, "Conversation">>();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const colors = useColors();
  const { userId } = useAuth();
  const { emit, isConnected } = useSocketContext();
  const conversationId = route.params.conversationId;
  const conversations = useConversations();
  const messagesQuery = useMessages(conversationId);
  const send = messagesQuery.send;
  const retry = messagesQuery.retry;
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const conversation = conversations.data?.find((item) => item.id === conversationId);
  const partnerId = conversation?.otherUser.id;
  const autoTranslate = conversation?.autoTranslate === true;
  const setAutoTranslate = useSetAutoTranslate();
  const { callUser, busy: calling } = useCallUser();

  useEffect(() => {
    if (!partnerId || !isConnected) {
      return;
    }
    void emit("user_online_status", { userId: partnerId }).catch(() => undefined);
  }, [partnerId, isConnected, emit]);

  const invertedMessages = useMemo(() => {
    // Infinite query pages are [newestBatch, olderBatch, …]; each batch is ascending.
    // For an inverted list: reverse each page, then concatenate (do not flatMap then reverse).
    const pages = messagesQuery.data?.pages ?? [];
    return pages.flatMap((page) => [...page.items].reverse());
  }, [messagesQuery.data]);

  useAutoTranslateIncoming(autoTranslate, invertedMessages, messagesQuery.translate);

  const visibleMessages = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) {
      return invertedMessages;
    }
    return invertedMessages.filter((message) => {
      const haystacks = [
        message.type === "TEXT" ? message.content : "",
        message.caption ?? "",
        message.transcript ?? "",
        message.translatedContent ?? "",
      ];
      return haystacks.some((part) => part.toLowerCase().includes(needle));
    });
  }, [invertedMessages, searchQuery]);

  const handleSend = useCallback(
    (content: string) => {
      void send(content);
    },
    [send],
  );

  const handleSendMedia = useCallback(
    (draft: ChatMediaDraft) => {
      void send({
        content: draft.uri,
        type: draft.type,
        durationMs: draft.durationMs,
        mimeType: draft.mimeType,
        fileName: draft.fileName,
        thumbnailUrl: draft.thumbnailUrl,
        uploadFromUri: draft.uri,
        caption: draft.caption?.trim() || undefined,
      });
    },
    [send],
  );

  const handleRetry = useCallback(
    (message: ChatMessage) => {
      void retry(message);
    },
    [retry],
  );

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) =>
      item.type === "SYSTEM" ? (
        <SystemNotice text={systemNoticeText(item, userId, conversation?.otherUser.displayName)} />
      ) : (
        <MessageBubble
          message={item}
          isMine={item.senderId === userId}
          onRetry={handleRetry}
          onTranslate={messagesQuery.translate}
          onTranscribe={messagesQuery.transcribe}
          onCorrect={messagesQuery.correct}
          onSavePhrase={messagesQuery.savePhrase}
        />
      ),
    [
      handleRetry,
      messagesQuery.translate,
      messagesQuery.transcribe,
      messagesQuery.correct,
      messagesQuery.savePhrase,
      userId,
      conversation?.otherUser.displayName,
    ],
  );

  const online = conversation?.otherUser.onlineStatus === "ONLINE";
  const subtitle = messagesQuery.partnerTyping
    ? `${conversation?.otherUser.displayName ?? "Partner"} is typing…`
    : online
      ? "Online"
      : messagesQuery.isConnected
        ? (conversation?.otherUser.country ?? "Language partner")
        : "Reconnecting";

  return (
    <Screen padded={false} includeBottomInset>
      <KeyboardSafeView style={[styles.flex, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <View style={styles.identity}>
            <View>
              <Avatar
                uri={conversation?.otherUser.avatarUrl ?? conversation?.otherUser.photoUrl}
                name={conversation?.otherUser.displayName}
                size={38}
              />
              <View
                style={[
                  styles.presence,
                  {
                    backgroundColor: online ? colors.presence : colors.muted,
                    borderColor: colors.background,
                  },
                ]}
              />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {conversation?.otherUser.displayName ?? "Chat"}
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { color: messagesQuery.partnerTyping ? colors.accent : colors.muted },
                ]}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            </View>
          </View>
          {conversation?.otherUser.id ? (
            <View style={styles.headerActions}>
              <Pressable
                style={styles.menuButton}
                disabled={calling}
                onPress={() =>
                  void callUser(
                    {
                      id: conversation.otherUser.id,
                      displayName: conversation.otherUser.displayName,
                      avatarUrl:
                        conversation.otherUser.avatarUrl ?? conversation.otherUser.photoUrl ?? null,
                      conversationId,
                    },
                    "AUDIO",
                  )
                }
                accessibilityRole="button"
                accessibilityLabel={`Audio call ${conversation.otherUser.displayName}`}
                accessibilityState={{ disabled: calling }}
              >
                {calling ? (
                  <ActivityIndicator size="small" color={colors.muted} />
                ) : (
                  <Ionicons name="call-outline" size={22} color={colors.accent} />
                )}
              </Pressable>
              <Pressable
                style={styles.menuButton}
                onPress={() => setAutoTranslate.mutate({ conversationId, enabled: !autoTranslate })}
                accessibilityRole="switch"
                accessibilityState={{ checked: autoTranslate }}
                accessibilityLabel="Translate incoming messages automatically"
              >
                <Ionicons
                  name={autoTranslate ? "language" : "language-outline"}
                  size={22}
                  color={autoTranslate ? colors.accent : colors.muted}
                />
              </Pressable>
              <Pressable
                style={styles.menuButton}
                onPress={() => setSearchOpen((open) => !open)}
                accessibilityRole="button"
                accessibilityLabel={searchOpen ? "Close search" : "Search messages"}
              >
                <Ionicons name={searchOpen ? "close" : "search"} size={22} color={colors.muted} />
              </Pressable>
              <Pressable
                style={styles.menuButton}
                onPress={() => setSafetyOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Block or report"
              >
                <Ionicons name="ellipsis-horizontal" size={22} color={colors.muted} />
              </Pressable>
            </View>
          ) : null}
        </View>

        {searchOpen ? (
          <View
            style={[
              styles.searchBar,
              { borderBottomColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search in this chat"
              placeholderTextColor={colors.muted}
              autoFocus
              style={[styles.searchInput, { color: colors.text }]}
              accessibilityLabel="Search messages in this chat"
            />
            {searchQuery.trim() ? (
              <Text style={[styles.searchCount, { color: colors.muted }]}>
                {visibleMessages.length} match{visibleMessages.length === 1 ? "" : "es"}
              </Text>
            ) : null}
          </View>
        ) : null}
        {messagesQuery.isLoading ? (
          // Fill the message area so the composer stays at the bottom while loading.
          <View style={styles.flex}>
            <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.lg }} />
          </View>
        ) : messagesQuery.isError ? (
          <View style={[styles.flex, styles.centered]}>
            <Text style={[styles.error, { color: colors.rose }]}>Could not load messages.</Text>
            <Pressable onPress={() => void messagesQuery.refetch()}>
              <Text style={[styles.retry, { color: colors.accent }]}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.flex}>
            <FlashList
              showsVerticalScrollIndicator={false}
              style={styles.flex}
              data={visibleMessages}
              inverted
              keyExtractor={(item) => item.clientMessageId ?? item.id}
              renderItem={renderItem}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              refreshControl={
                <AppRefreshControl
                  refreshing={messagesQuery.isRefetching && !messagesQuery.isFetchingNextPage}
                  onRefresh={() => void messagesQuery.refetch()}
                />
              }
              maintainVisibleContentPosition={CHAT_LIST_MVCP}
              contentContainerStyle={styles.list}
              onEndReachedThreshold={0.2}
              onEndReached={() => {
                if (messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage) {
                  void messagesQuery.fetchNextPage();
                }
              }}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Text style={[styles.empty, { color: colors.muted }]}>
                    {searchQuery.trim()
                      ? "No messages match that search in the loaded history."
                      : "Say hello and start practicing together."}
                  </Text>
                </View>
              }
              ListFooterComponent={
                messagesQuery.isFetchingNextPage ? (
                  <ActivityIndicator color={colors.accent} />
                ) : undefined
              }
            />
            {messagesQuery.partnerTyping ? (
              <View style={styles.typingDock}>
                <TypingIndicator name={conversation?.otherUser.displayName} />
              </View>
            ) : null}
          </View>
        )}

        <ChatInput
          initialValue={route.params.draft}
          onSend={handleSend}
          onSendMedia={handleSendMedia}
          onTypingChange={messagesQuery.setTyping}
          // Always usable: without the live socket, messages are sent over HTTP instead.
        />
      </KeyboardSafeView>

      {conversation?.otherUser.id ? (
        <BlockReportMenu
          visible={safetyOpen}
          userId={conversation.otherUser.id}
          userName={conversation.otherUser.displayName}
          onClose={() => setSafetyOpen(false)}
          onBlocked={() => navigation.navigate("MainTabs", { screen: "Chats" })}
        />
      ) : null}
    </Screen>
  );
}

/** CHAT-002 alias */

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    minHeight: 40,
    fontSize: 15,
  },
  searchCount: {
    fontSize: 12,
    fontWeight: "600",
  },
  back: {
    width: 36,
    height: 40,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  identity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 1,
    fontWeight: "500",
    fontSize: 12,
  },
  presence: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  menuButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  typingDock: {
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  // No manual flip: the inverted list already un-inverts its ListEmptyComponent;
  // adding one mirrors the text on Android.
  emptyWrap: {},
  empty: {
    textAlign: "center",
    marginTop: spacing.xl,
    fontSize: 15,
  },
  error: {
    fontWeight: "700",
  },
  retry: {
    fontWeight: "700",
    marginTop: spacing.sm,
  },
  centered: {
    alignItems: "center",
    marginTop: spacing.lg,
  },
});
