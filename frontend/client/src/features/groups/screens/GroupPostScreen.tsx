import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FlashList } from "@shopify/flash-list";
import { GROUP_COMMENT_MAX } from "@sayly/shared";
import { memo, useCallback } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/features/auth";
import { isApiError } from "@/lib/api/errors";
import type { AppStackParamList } from "@/navigation/types";
import { Avatar } from "@/shared/components/Avatar";
import { KeyboardSafeView } from "@/shared/components/KeyboardSafeView";
import { PressableScale } from "@/shared/components/PressableScale";
import { Screen } from "@/shared/components/Screen";
import { WarmErrorState } from "@/shared/components/WarmErrorState";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";
import { confirmAction } from "@/shared/utils/confirmAction";
import { relativeTime } from "@/shared/utils/relativeTime";

import { FeedComposer } from "../components/FeedComposer";
import { PostCard } from "../components/PostCard";
import {
  useDeletePost,
  useGroupPost,
  usePostComments,
  usePostReaction,
} from "../hooks/useGroupFeed";
import { useGroup } from "../hooks/useGroups";
import { isGroupModerator } from "../model/groupModel";
import type { FeedComment } from "../model/feedModel";

function showError(error: unknown) {
  Alert.alert("Something went wrong", isApiError(error) ? error.message : "Please try again.");
}

const CommentRow = memo(function CommentRow({
  comment,
  canDelete,
  onDelete,
  onRetry,
}: {
  comment: FeedComment;
  canDelete: boolean;
  onDelete: (comment: FeedComment) => void;
  onRetry: (comment: FeedComment) => void;
}) {
  const colors = useColors();
  const failed = comment.localState === "failed";
  const status = failed
    ? "Not sent — tap to retry"
    : comment.localState === "sending"
      ? "Sending…"
      : relativeTime(comment.createdAt);

  return (
    <View style={[styles.comment, comment.localState && styles.pending]}>
      <Avatar uri={comment.author.avatarUrl} name={comment.author.displayName} size={30} />
      <PressableScale
        onPress={() => (failed ? onRetry(comment) : undefined)}
        onLongPress={() => (canDelete && !comment.localState ? onDelete(comment) : undefined)}
        style={[styles.bubble, { backgroundColor: colors.surface }]}
        accessibilityRole={failed ? "button" : undefined}
        accessibilityLabel={failed ? "Comment not sent. Retry" : undefined}
        accessibilityHint={canDelete ? "Long press to delete" : undefined}
        scaleTo={0.99}
      >
        <Text style={[styles.commentAuthor, { color: colors.text }]}>
          {comment.author.displayName}
        </Text>
        <Text style={[styles.commentBody, { color: colors.text }]} selectable>
          {comment.body}
        </Text>
        <Text style={[styles.commentMeta, { color: failed ? colors.error : colors.muted }]}>
          {status}
        </Text>
      </PressableScale>
    </View>
  );
});

export function GroupPostScreen() {
  const route = useRoute<RouteProp<AppStackParamList, "GroupPost">>();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const colors = useColors();
  const { userId } = useAuth();
  const { groupId, postId } = route.params;
  const group = useGroup(groupId);
  const moderator = isGroupModerator(group.data?.viewer ?? null);
  const post = useGroupPost(groupId, postId);
  const thread = usePostComments(groupId, postId);
  const react = usePostReaction(groupId);
  const deletePost = useDeletePost(groupId);

  const onDeleteComment = useCallback(
    (comment: FeedComment) =>
      confirmAction({
        title: "Delete comment",
        message: "Delete this comment for everyone?",
        confirmLabel: "Delete",
        onConfirm: () => thread.remove.mutate(comment.id, { onError: showError }),
      }),
    [thread.remove],
  );

  const renderItem = useCallback(
    ({ item }: { item: FeedComment }) => (
      <CommentRow
        comment={item}
        canDelete={item.author.id === userId || moderator}
        onDelete={onDeleteComment}
        onRetry={thread.retry}
      />
    ),
    [userId, moderator, onDeleteComment, thread.retry],
  );

  if (!post.data) {
    if (post.isPending) {
      return (
        <ActivityIndicator
          style={styles.loading}
          color={colors.accent}
          accessibilityLabel="Loading post"
        />
      );
    }
    const gone = isApiError(post.error) && post.error.status === 404;
    return (
      <Screen includeBottomInset>
        <WarmErrorState
          title={gone ? "This post was deleted" : "Could not load this post"}
          body={gone ? undefined : "Check your connection and try again."}
          actionLabel={gone ? "Back to feed" : "Try again"}
          onAction={() => (gone ? navigation.goBack() : void post.refetch())}
        />
      </Screen>
    );
  }

  const current = post.data;
  const header = (
    <View style={styles.header}>
      <PostCard
        post={current}
        expanded
        onReact={react}
        onDelete={
          current.author.id === userId || moderator
            ? () =>
                confirmAction({
                  title: "Delete post",
                  message: "Delete this post and its comments for everyone?",
                  confirmLabel: "Delete",
                  onConfirm: () =>
                    deletePost.mutate(current.id, {
                      onSuccess: () => navigation.goBack(),
                      onError: showError,
                    }),
                })
            : undefined
        }
      />
      {thread.hasNextPage ? (
        <PressableScale
          onPress={() => void thread.fetchNextPage()}
          disabled={thread.isFetchingNextPage}
          style={styles.older}
          accessibilityRole="button"
          accessibilityLabel="Show older comments"
        >
          <Text style={[styles.olderText, { color: colors.accent }]}>
            {thread.isFetchingNextPage ? "Loading…" : "Show older comments"}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );

  return (
    <Screen padded={false} includeBottomInset>
      <KeyboardSafeView style={styles.flex}>
        <FlashList
          data={thread.comments}
          keyExtractor={(item) => item.clientId ?? item.id}
          renderItem={renderItem}
          ListHeaderComponent={header}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            thread.isPending ? (
              <ActivityIndicator color={colors.accent} style={styles.loading} />
            ) : (
              <Text style={[styles.empty, { color: colors.muted }]}>
                No comments yet. Be the first!
              </Text>
            )
          }
        />
        <FeedComposer
          placeholder="Write a comment…"
          maxLength={GROUP_COMMENT_MAX}
          accessibilityLabel="New comment"
          onSend={thread.send}
        />
      </KeyboardSafeView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { marginVertical: spacing.lg },
  list: { padding: spacing.md },
  header: { gap: spacing.sm, marginBottom: spacing.md },
  older: { alignSelf: "center", padding: spacing.sm },
  olderText: { fontSize: 14, fontWeight: "700" },
  empty: { textAlign: "center", fontSize: 14, fontWeight: "500", marginTop: spacing.md },
  comment: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: spacing.sm },
  pending: { opacity: 0.7 },
  bubble: { flex: 1, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  commentAuthor: { fontSize: 13, fontWeight: "700" },
  commentBody: { fontSize: 15, lineHeight: 21 },
  commentMeta: { fontSize: 11, fontWeight: "500" },
});
