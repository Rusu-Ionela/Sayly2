import { Ionicons } from "@expo/vector-icons";
import {
  GROUP_POST_REACTION_EMOJI,
  GROUP_POST_REACTIONS,
  type GroupPostReaction,
} from "@sayly/shared";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/shared/components/Avatar";
import { PressableScale } from "@/shared/components/PressableScale";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";
import { relativeTime } from "@/shared/utils/relativeTime";

import type { FeedPost } from "../model/feedModel";

type PostCardProps = {
  post: FeedPost;
  /** Opens the thread; omitted on the post screen itself. */
  onOpen?: (post: FeedPost) => void;
  onReact: (post: FeedPost, kind: GroupPostReaction) => void;
  onRetry?: (post: FeedPost) => void;
  /** Shown when the viewer is the author or a moderator. */
  onDelete?: (post: FeedPost) => void;
  /** Show the full text instead of a preview. */
  expanded?: boolean;
};

export const PostCard = memo(function PostCard({
  post,
  onOpen,
  onReact,
  onRetry,
  onDelete,
  expanded = false,
}: PostCardProps) {
  const colors = useColors();
  const failed = post.localState === "failed";
  const pending = Boolean(post.localState);
  const question = post.kind === "QUESTION";

  const status = failed
    ? "Not posted — tap to retry"
    : post.localState === "sending"
      ? "Posting…"
      : relativeTime(post.createdAt);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.cardBorder },
        pending && styles.pending,
      ]}
    >
      <View style={styles.header}>
        <Avatar uri={post.author.avatarUrl} name={post.author.displayName} size={36} />
        <View style={styles.headerCopy}>
          <Text style={[styles.author, { color: colors.text }]} numberOfLines={1}>
            {post.author.displayName}
          </Text>
          <Text style={[styles.meta, { color: failed ? colors.error : colors.muted }]}>
            {status}
          </Text>
        </View>
        {question ? (
          <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="help-circle" size={14} color={colors.accent} />
            <Text style={[styles.badgeText, { color: colors.accent }]}>Question</Text>
          </View>
        ) : null}
        {onDelete && !pending ? (
          <PressableScale
            onPress={() => onDelete(post)}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Delete post"
          >
            <Ionicons name="trash-outline" size={18} color={colors.muted} />
          </PressableScale>
        ) : null}
      </View>

      <PressableScale
        onPress={() => (failed ? onRetry?.(post) : onOpen?.(post))}
        disabled={!failed && !onOpen}
        accessibilityRole={onOpen || failed ? "button" : undefined}
        accessibilityLabel={failed ? "Post not sent. Retry" : onOpen ? "Open post" : undefined}
        scaleTo={0.99}
      >
        <Text
          style={[styles.body, { color: colors.text }]}
          numberOfLines={expanded ? undefined : 8}
          selectable={expanded}
        >
          {post.body}
        </Text>
      </PressableScale>

      <View style={styles.footer}>
        <View style={styles.reactions}>
          {GROUP_POST_REACTIONS.map((kind) => {
            const mine = post.reactions.mine === kind;
            const total = post.reactions.counts[kind];
            return (
              <PressableScale
                key={kind}
                onPress={() => onReact(post, kind)}
                disabled={pending}
                scaleTo={0.9}
                style={[
                  styles.reaction,
                  {
                    backgroundColor: mine ? colors.accentSoft : "transparent",
                    borderColor: mine ? colors.accent : colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: mine }}
                accessibilityLabel={`${kind.toLowerCase()} reaction, ${total}`}
              >
                <Text style={styles.emoji}>{GROUP_POST_REACTION_EMOJI[kind]}</Text>
                {total > 0 ? (
                  <Text style={[styles.count, { color: mine ? colors.accent : colors.muted }]}>
                    {total}
                  </Text>
                ) : null}
              </PressableScale>
            );
          })}
        </View>
        <PressableScale
          onPress={() => onOpen?.(post)}
          disabled={!onOpen || pending}
          style={styles.comments}
          accessibilityRole="button"
          accessibilityLabel={`${post.commentCount} comments`}
        >
          <Ionicons name="chatbubble-outline" size={16} color={colors.muted} />
          <Text style={[styles.count, { color: colors.muted }]}>{post.commentCount}</Text>
        </PressableScale>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, gap: 10 },
  pending: { opacity: 0.7 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerCopy: { flex: 1, minWidth: 0 },
  author: { fontSize: 15, fontWeight: "700" },
  meta: { fontSize: 12, fontWeight: "500" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  badgeText: { fontSize: 12, fontWeight: "700" },
  iconBtn: { padding: 6 },
  body: { fontSize: 15, lineHeight: 22 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  reactions: { flexDirection: "row", gap: 6, flexWrap: "wrap", flex: 1 },
  reaction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 32,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  emoji: { fontSize: 15 },
  count: { fontSize: 13, fontWeight: "700" },
  comments: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 32,
    paddingHorizontal: 6,
  },
});
