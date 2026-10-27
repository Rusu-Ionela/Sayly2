import { z } from "zod";

import { multilineTextSchema } from "./validation";

/**
 * Group feed: members publish posts (thoughts, questions), others comment and react.
 * Only active group members read or write; the API enforces it on every route.
 */
export const GROUP_POST_MAX = 2_000;
export const GROUP_COMMENT_MAX = 1_000;
/** Default page size for both posts and comments. */
export const GROUP_FEED_PAGE_SIZE = 20;

/** What a post is, so the feed can badge questions differently from thoughts. */
export const GROUP_POST_KINDS = ["THOUGHT", "QUESTION"] as const;
export type GroupPostKind = (typeof GROUP_POST_KINDS)[number];

/** One reaction per member and post; picking another replaces it. */
export const GROUP_POST_REACTIONS = ["LIKE", "LOVE", "HAHA", "CLAP"] as const;
export type GroupPostReaction = (typeof GROUP_POST_REACTIONS)[number];

export const GROUP_POST_REACTION_EMOJI: Record<GroupPostReaction, string> = {
  LIKE: "👍",
  LOVE: "❤️",
  HAHA: "😂",
  CLAP: "👏",
};

/** Server -> client socket events, sent to every active member of the group. */
export const GROUP_FEED_EVENTS = {
  postNew: "group_post_new",
  postUpdated: "group_post_updated",
  postDeleted: "group_post_deleted",
  commentNew: "group_post_comment_new",
  commentDeleted: "group_post_comment_deleted",
} as const;

const clientIdSchema = z.string().trim().min(8).max(80);

/** POST /groups/:id/posts */
export const createGroupPostSchema = z
  .object({
    body: multilineTextSchema(GROUP_POST_MAX, "Post").pipe(z.string().min(1, "Write something")),
    kind: z.enum(GROUP_POST_KINDS).default("THOUGHT"),
    clientId: clientIdSchema.optional(),
  })
  .strict();
export type CreateGroupPostInput = z.input<typeof createGroupPostSchema>;

/** POST /groups/:id/posts/:postId/comments */
export const createGroupCommentSchema = z
  .object({
    body: multilineTextSchema(GROUP_COMMENT_MAX, "Comment").pipe(
      z.string().min(1, "Write a comment"),
    ),
    clientId: clientIdSchema.optional(),
  })
  .strict();
export type CreateGroupCommentInput = z.input<typeof createGroupCommentSchema>;

/** PUT /groups/:id/posts/:postId/reaction */
export const setGroupPostReactionSchema = z.object({ kind: z.enum(GROUP_POST_REACTIONS) }).strict();
export type SetGroupPostReactionInput = z.infer<typeof setGroupPostReactionSchema>;

const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

/** Keyset pagination: `before` is the id of the oldest item already shown. */
export const groupFeedPageQuerySchema = z.object({
  before: z.preprocess(blankToUndefined, z.string().trim().min(1).max(64).optional()),
  limit: z.coerce.number().int().min(1).max(50).default(GROUP_FEED_PAGE_SIZE),
});
export type GroupFeedPageQuery = z.infer<typeof groupFeedPageQuerySchema>;

export type GroupFeedAuthorDto = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

export type GroupPostReactionSummary = {
  /** Count per reaction kind; kinds nobody used are 0. */
  counts: Record<GroupPostReaction, number>;
  total: number;
  /** The viewer's own reaction. Socket broadcasts carry null; clients keep their own value. */
  mine: GroupPostReaction | null;
};

export type GroupPostDto = {
  id: string;
  groupId: string;
  kind: GroupPostKind;
  body: string;
  author: GroupFeedAuthorDto;
  commentCount: number;
  reactions: GroupPostReactionSummary;
  createdAt: string;
  clientId: string | null;
};

export type GroupCommentDto = {
  id: string;
  postId: string;
  groupId: string;
  body: string;
  author: GroupFeedAuthorDto;
  createdAt: string;
  clientId: string | null;
};

export type GroupPostsPage = {
  items: GroupPostDto[];
  nextCursor: string | null;
  hasMore: boolean;
};

/** Oldest first, so the thread reads top to bottom; `before` loads older comments. */
export type GroupCommentsPage = {
  items: GroupCommentDto[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type GroupPostNewEvent = GroupPostDto;
/** Counts changed (reaction or comment). `reactions.mine` is null; keep the local value. */
export type GroupPostUpdatedEvent = Pick<GroupPostDto, "id" | "groupId" | "commentCount"> & {
  reactions: Omit<GroupPostReactionSummary, "mine">;
};
export type GroupPostDeletedEvent = { id: string; groupId: string };
export type GroupCommentNewEvent = GroupCommentDto & { commentCount: number };
export type GroupCommentDeletedEvent = {
  id: string;
  postId: string;
  groupId: string;
  commentCount: number;
};

export function emptyReactionCounts(): Record<GroupPostReaction, number> {
  return { LIKE: 0, LOVE: 0, HAHA: 0, CLAP: 0 };
}
