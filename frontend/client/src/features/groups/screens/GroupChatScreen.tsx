import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardSafeView } from "@/shared/components/KeyboardSafeView";

import { useAuth } from "@/features/auth";
import { formatMessageClock } from "@/features/chat/utils/formatChatTime";
import { isApiError } from "@/lib/api/errors";
import type { AppStackParamList } from "@/navigation/types";
import { Avatar } from "@/shared/components/Avatar";
import { PressableScale } from "@/shared/components/PressableScale";
import { Screen } from "@/shared/components/Screen";
import { WarmEmptyState } from "@/shared/components/WarmEmptyState";
import { WarmErrorState } from "@/shared/components/WarmErrorState";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

import { useGroup, useGroupChat } from "../hooks/useGroups";
import type { GroupMessage } from "../types";

const MAX_LENGTH = 4000;

const Bubble = memo(function Bubble({
  message,
  mine,
  showSender,
  onRetry,
}: {
  message: GroupMessage;
  mine: boolean;
  showSender: boolean;
  onRetry: (message: GroupMessage) => void;
}) {
  const colors = useColors();
  const failed = message.localState === "failed";
  const sending = message.localState === "sending";
  const status = failed
    ? "Not sent — tap to retry"
    : sending
      ? "Sending…"
      : formatMessageClock(message.createdAt);

  const body = (
    <View
      style={[
        styles.bubble,
        mine
          ? { backgroundColor: colors.accent }
          : { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1 },
        failed && { opacity: 0.7 },
      ]}
    >
      {showSender && !mine ? (
        <Text style={[styles.sender, { color: colors.accent }]}>{message.sender.displayName}</Text>
      ) : null}
      <Text style={[styles.text, { color: mine ? colors.onPrimary : colors.text }]} selectable>
        {message.content}
      </Text>
      <Text
        style={[
          styles.time,
          { color: failed ? colors.error : mine ? "rgba(255,255,255,0.75)" : colors.muted },
        ]}
      >
        {status}
      </Text>
    </View>
  );

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      {!mine ? (
        <View style={styles.avatarSlot}>
          {showSender ? (
            <Avatar uri={message.sender.avatarUrl} name={message.sender.displayName} size={30} />
          ) : null}
        </View>
      ) : null}
      {failed ? (
        <PressableScale
          onPress={() => onRetry(message)}
          accessibilityRole="button"
          accessibilityLabel="Message not sent. Retry"
          style={styles.bubbleWrap}
        >
          {body}
        </PressableScale>
      ) : (
        <View style={styles.bubbleWrap}>{body}</View>
      )}
    </View>
  );
});

export function GroupChatScreen() {
  const route = useRoute<RouteProp<AppStackParamList, "GroupChat">>();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const colors = useColors();
  const { userId } = useAuth();
  const groupId = route.params.groupId;
  const group = useGroup(groupId);
  const isMember = group.data?.viewer?.status === "ACTIVE";
  const chat = useGroupChat(groupId, isMember);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (group.data) {
      navigation.setOptions({
        title: group.data.name,
        headerRight: () => (
          <PressableScale
            onPress={() => navigation.navigate("GroupDetail", { groupId })}
            accessibilityRole="button"
            accessibilityLabel="Group info"
            style={styles.headerBtn}
          >
            <Ionicons name="information-circle-outline" size={24} color={colors.accent} />
          </PressableScale>
        ),
      });
    }
  }, [group.data, navigation, groupId, colors.accent]);

  // Inverted list: newest first.
  const data = useMemo(() => [...chat.messages].reverse(), [chat.messages]);

  const renderItem = useCallback(
    ({ item, index }: { item: GroupMessage; index: number }) => {
      const older = data[index + 1];
      return (
        <Bubble
          message={item}
          mine={item.senderId === userId}
          showSender={!older || older.senderId !== item.senderId}
          onRetry={chat.retry}
        />
      );
    },
    [data, userId, chat.retry],
  );

  const trimmed = draft.trim();
  const send = () => {
    if (!trimmed) return;
    chat.send(trimmed);
    setDraft("");
  };

  if (group.isPending) {
    return (
      <ActivityIndicator
        style={styles.loading}
        color={colors.accent}
        accessibilityLabel="Loading discussion"
      />
    );
  }
  if (!isMember) {
    return (
      <Screen includeBottomInset>
        <WarmErrorState
          title="Members only"
          body="Join this group to read and post in its discussion."
          actionLabel="View group"
          onAction={() => navigation.replace("GroupDetail", { groupId })}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false} includeBottomInset>
      <KeyboardSafeView style={styles.flex}>
        {chat.isError && data.length === 0 ? (
          <WarmErrorState
            title="Could not load messages"
            body={
              isApiError(chat.error) ? chat.error.message : "Check your connection and try again."
            }
            onAction={() => void chat.refetch()}
          />
        ) : (
          <FlatList
            showsVerticalScrollIndicator={false}
            inverted
            data={data}
            keyExtractor={(item) => item.clientMessageId ?? item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            onEndReachedThreshold={0.3}
            onEndReached={() => {
              if (chat.hasNextPage && !chat.isFetchingNextPage) void chat.fetchNextPage();
            }}
            ListFooterComponent={
              chat.isFetchingNextPage || chat.isPending ? (
                <ActivityIndicator color={colors.accent} style={styles.loading} />
              ) : null
            }
            ListEmptyComponent={
              chat.isPending ? null : (
                <View style={styles.emptyFlip}>
                  <WarmEmptyState
                    title="Say hello 👋"
                    body="Introduce yourself and what you'd like to practice. Everyone here is learning too."
                  />
                </View>
              )
            }
          />
        )}

        <View
          style={[
            styles.composer,
            { borderTopColor: colors.border, backgroundColor: colors.background },
          ]}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={`Message ${group.data?.language.name ?? ""} group`.trim()}
            placeholderTextColor={colors.placeholder}
            multiline
            maxLength={MAX_LENGTH}
            accessibilityLabel="Message"
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text }]}
          />
          <PressableScale
            onPress={send}
            disabled={!trimmed}
            style={[styles.sendBtn, { backgroundColor: trimmed ? colors.accent : colors.trail }]}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <Ionicons name="arrow-up" size={20} color={trimmed ? colors.onPrimary : colors.muted} />
          </PressableScale>
        </View>
      </KeyboardSafeView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { marginVertical: spacing.lg },
  list: { flexGrow: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  // The inverted FlatList already un-inverts its empty component; a manual flip mirrors it on Android.
  emptyFlip: { flex: 1, justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "flex-end", marginVertical: 2, gap: 6 },
  rowMine: { justifyContent: "flex-end" },
  rowTheirs: { justifyContent: "flex-start" },
  avatarSlot: { width: 30 },
  bubbleWrap: { maxWidth: "78%" },
  bubble: { borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  sender: { fontSize: 12, fontWeight: "700" },
  text: { fontSize: 15, lineHeight: 21 },
  time: { fontSize: 11, fontWeight: "500", alignSelf: "flex-end" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtn: { padding: 4 },
});
