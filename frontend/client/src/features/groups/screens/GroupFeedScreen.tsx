import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FlashList } from "@shopify/flash-list";
import { GROUP_POST_MAX, type GroupPostKind } from "@sayly/shared";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/features/auth";
import { isApiError } from "@/lib/api/errors";
import type { AppStackParamList } from "@/navigation/types";
import { KeyboardSafeView } from "@/shared/components/KeyboardSafeView";
import { PressableScale } from "@/shared/components/PressableScale";
import { Screen } from "@/shared/components/Screen";
import { WarmEmptyState } from "@/shared/components/WarmEmptyState";
import { WarmErrorState } from "@/shared/components/WarmErrorState";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";
import { confirmAction } from "@/shared/utils/confirmAction";

import { FeedComposer } from "../components/FeedComposer";
import { PostCard } from "../components/PostCard";
import { useDeletePost, useGroupFeed, usePostReaction } from "../hooks/useGroupFeed";
import { useGroup } from "../hooks/useGroups";
import { isGroupModerator } from "../model/groupModel";
import type { FeedPost } from "../model/feedModel";

/** Thought / question switch next to the composer. */
function KindToggle({
  kind,
  onChange,
}: {
  kind: GroupPostKind;
  onChange: (kind: GroupPostKind) => void;
}) {
  const colors = useColors();
  const question = kind === "QUESTION";
  return (
    <PressableScale
      onPress={() => onChange(question ? "THOUGHT" : "QUESTION")}
      style={[styles.kind, { backgroundColor: question ? colors.accent : colors.accentSoft }]}
      accessibilityRole="switch"
      accessibilityState={{ checked: question }}
      accessibilityLabel={question ? "Posting a question" : "Posting a thought. Switch to question"}
    >
      <Ionicons
        name={question ? "help" : "bulb-outline"}
        size={20}
        color={question ? colors.onPrimary : colors.accent}
      />
    </PressableScale>
  );
}

export function GroupFeedScreen() {
  const route = useRoute<RouteProp<AppStackParamList, "GroupFeed">>();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const colors = useColors();
  const { userId } = useAuth();
  const groupId = route.params.groupId;
  const group = useGroup(groupId);
  const isMember = group.data?.viewer?.status === "ACTIVE";
  const moderator = isGroupModerator(group.data?.viewer ?? null);
  const feed = useGroupFeed(groupId, isMember);
  const react = usePostReaction(groupId);
  const deletePost = useDeletePost(groupId);
  const [kind, setKind] = useState<GroupPostKind>("THOUGHT");

  useEffect(() => {
    if (group.data) navigation.setOptions({ title: `${group.data.name} · Feed` });
  }, [group.data, navigation]);

  const openPost = useCallback(
    (post: FeedPost) => navigation.navigate("GroupPost", { groupId, postId: post.id }),
    [navigation, groupId],
  );

  const onDelete = useCallback(
    (post: FeedPost) =>
      confirmAction({
        title: "Delete post",
        message: "Delete this post and its comments for everyone?",
        confirmLabel: "Delete",
        onConfirm: () =>
          deletePost.mutate(post.id, {
            onError: (error) =>
              Alert.alert(
                "Could not delete",
                isApiError(error) ? error.message : "Please try again.",
              ),
          }),
      }),
    [deletePost],
  );

  const renderItem = useCallback(
    ({ item }: { item: FeedPost }) => (
      <PostCard
        post={item}
        onOpen={openPost}
        onReact={react}
        onRetry={feed.retry}
        onDelete={item.author.id === userId || moderator ? onDelete : undefined}
      />
    ),
    [openPost, react, feed.retry, userId, moderator, onDelete],
  );

  if (group.isPending) {
    return (
      <ActivityIndicator
        style={styles.loading}
        color={colors.accent}
        accessibilityLabel="Loading feed"
      />
    );
  }
  if (!isMember) {
    return (
      <Screen includeBottomInset>
        <WarmErrorState
          title="Members only"
          body="Join this group to read and share posts."
          actionLabel="View group"
          onAction={() => navigation.replace("GroupDetail", { groupId })}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false} includeBottomInset>
      <KeyboardSafeView style={styles.flex}>
        {feed.isError && feed.posts.length === 0 ? (
          <WarmErrorState
            title="Could not load the feed"
            body={
              isApiError(feed.error) ? feed.error.message : "Check your connection and try again."
            }
            onAction={() => void feed.refetch()}
          />
        ) : (
          <FlashList
            data={feed.posts}
            keyExtractor={(item) => item.clientId ?? item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={Separator}
            showsVerticalScrollIndicator={false}
            onRefresh={() => void feed.refetch()}
            refreshing={feed.isRefetching && !feed.isFetchingNextPage}
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
            }}
            ListFooterComponent={
              feed.isFetchingNextPage || feed.isPending ? (
                <ActivityIndicator color={colors.accent} style={styles.loading} />
              ) : undefined
            }
            ListEmptyComponent={
              feed.isPending ? undefined : (
                <WarmEmptyState
                  title="Start the conversation ✨"
                  body="Share a thought, a new word you learned, or ask the group a question."
                />
              )
            }
          />
        )}
        {kind === "QUESTION" ? (
          <Text style={[styles.hint, { color: colors.accent }]}>
            Your post will be marked as a question
          </Text>
        ) : null}
        <FeedComposer
          placeholder={kind === "QUESTION" ? "Ask the group…" : "Share a thought…"}
          maxLength={GROUP_POST_MAX}
          accessibilityLabel="New post"
          onSend={(text) => {
            feed.publish(text, kind);
            setKind("THOUGHT");
          }}
          leading={<KindToggle kind={kind} onChange={setKind} />}
        />
      </KeyboardSafeView>
    </Screen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { marginVertical: spacing.lg },
  list: { padding: spacing.md },
  separator: { height: spacing.sm + 4 },
  hint: { fontSize: 12, fontWeight: "700", textAlign: "center", paddingTop: 4 },
  kind: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
