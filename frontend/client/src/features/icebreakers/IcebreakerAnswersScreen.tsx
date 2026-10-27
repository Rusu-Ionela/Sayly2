import type { IcebreakerAnswerDto } from "@sayly/shared";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FlashList } from "@shopify/flash-list";
import { memo, useCallback, useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useOpenChat } from "@/features/chat/hooks/useOpenChat";
import type { AppStackParamList } from "@/navigation/types";
import { AppRefreshControl } from "@/shared/components/AppRefreshControl";
import { Avatar } from "@/shared/components/Avatar";
import { WarmEmptyState } from "@/shared/components/WarmEmptyState";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";
import { relativeTime } from "@/shared/utils/relativeTime";

import { useIcebreakerAnswers } from "./hooks";
import { replyDraft } from "./model";

type Route = RouteProp<AppStackParamList, "IcebreakerAnswers">;

const AnswerRow = memo(function AnswerRow({
  answer,
  busy,
  onProfile,
  onReply,
}: {
  answer: IcebreakerAnswerDto;
  busy: boolean;
  onProfile: (userId: string) => void;
  onReply: (answer: IcebreakerAnswerDto) => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <Pressable
        onPress={() => onProfile(answer.author.id)}
        style={styles.author}
        accessibilityRole="button"
        accessibilityLabel={`Open ${answer.author.displayName}'s profile`}
      >
        <Avatar uri={answer.author.avatarUrl} name={answer.author.displayName} size={40} />
        <View style={styles.authorText}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {answer.author.displayName}
          </Text>
          <Text style={[styles.time, { color: colors.muted }]}>
            {relativeTime(answer.createdAt)}
          </Text>
        </View>
      </Pressable>
      <Text style={[styles.body, { color: colors.text }]}>{answer.body}</Text>
      <Pressable
        onPress={() => onReply(answer)}
        disabled={busy}
        style={({ pressed }) => [
          styles.reply,
          { backgroundColor: colors.accentSoft },
          (pressed || busy) && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Reply to ${answer.author.displayName} in a chat`}
      >
        {busy ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Text style={[styles.replyText, { color: colors.accent }]}>Reply in chat</Text>
        )}
      </Pressable>
    </View>
  );
});

/** Everyone's answers to today's question; each one is a way into a conversation. */
export function IcebreakerAnswersScreen() {
  const colors = useColors();
  const { params } = useRoute<Route>();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const answers = useIcebreakerAnswers(params.languageId);
  const { openChat, busyUserId } = useOpenChat();

  const items = useMemo(
    () => answers.data?.pages.flatMap((page) => page.items) ?? [],
    [answers.data],
  );

  const onProfile = useCallback(
    (memberId: string) => navigation.navigate("PublicProfile", { userId: memberId }),
    [navigation],
  );
  const onReply = useCallback(
    (answer: IcebreakerAnswerDto) =>
      void openChat(answer.author.id, null, replyDraft(params.question, answer.body)),
    [openChat, params.question],
  );

  return (
    <View style={styles.screen}>
      <FlashList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AnswerRow
            answer={item}
            busy={busyUserId === item.author.id}
            onProfile={onProfile}
            onReply={onReply}
          />
        )}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.kicker, { color: colors.accent }]}>
              TODAY IN {params.languageName.toUpperCase()}
            </Text>
            <Text style={[styles.question, { color: colors.text }]}>{params.question}</Text>
          </View>
        }
        ListEmptyComponent={
          answers.isPending ? (
            <ActivityIndicator color={colors.accent} style={styles.loading} />
          ) : (
            <WarmEmptyState
              title={answers.isError ? "Could not load answers" : "No answers yet"}
              body={
                answers.isError
                  ? "Check your connection and pull to refresh."
                  : "Be the first to answer: others will see it and can reply to you."
              }
            />
          )
        }
        ListFooterComponent={
          answers.isFetchingNextPage ? <ActivityIndicator color={colors.accent} /> : undefined
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (answers.hasNextPage && !answers.isFetchingNextPage) void answers.fetchNextPage();
        }}
        refreshControl={
          <AppRefreshControl
            refreshing={answers.isRefetching && !answers.isFetchingNextPage}
            onRefresh={() => void answers.refetch()}
          />
        }
        extraData={busyUserId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: spacing.md },
  header: { gap: spacing.xs, marginBottom: spacing.md },
  kicker: { fontSize: 12, fontWeight: "800", letterSpacing: 0.8 },
  question: { fontSize: 20, lineHeight: 27, fontWeight: "800" },
  loading: { marginTop: spacing.lg },
  row: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  author: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  authorText: { flex: 1 },
  name: { fontSize: 16, fontWeight: "700" },
  time: { fontSize: 12, fontWeight: "500" },
  body: { fontSize: 16, lineHeight: 23 },
  reply: {
    alignSelf: "flex-start",
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    justifyContent: "center",
  },
  replyText: { fontSize: 14, fontWeight: "800" },
  pressed: { opacity: 0.7 },
});
