import { and, count, desc, eq, inArray, lt, or } from "drizzle-orm";
import {
  emptyReactionCounts,
  GROUP_POST_REACTIONS,
  type GroupFeedAuthorDto,
  type GroupPostKind,
  type GroupPostReaction,
} from "@sayly/shared";

import { db } from "../../db/client";
import { isUniqueViolation } from "../../db/errors";
import {
  groupPostComments,
  groupPostReactions,
  groupPosts,
  profiles,
  type GroupPost,
  type GroupPostComment,
} from "../../db/schema";
import { resignMediaUrl } from "../media/storage";

export type ReactionTally = { counts: Record<GroupPostReaction, number>; total: number };

const isReaction = (value: string): value is GroupPostReaction =>
  (GROUP_POST_REACTIONS as readonly string[]).includes(value);

/** Author cards; a deleted or unknown author still renders as a neutral member. */
export async function loadAuthors(userIds: string[]): Promise<Map<string, GroupFeedAuthorDto>> {
  const ids = [...new Set(userIds)];
  const authors = new Map<string, GroupFeedAuthorDto>();
  if (ids.length > 0) {
    const rows = await db
      .select({ id: profiles.userId, displayName: profiles.displayName, avatar: profiles.profileImageUrl })
      .from(profiles)
      .where(inArray(profiles.userId, ids));
    for (const row of rows) {
      authors.set(row.id, {
        id: row.id,
        displayName: row.displayName || "Sayly member",
        avatarUrl: row.avatar ? (resignMediaUrl(row.avatar) ?? row.avatar) : null,
      });
    }
  }
  for (const id of ids) {
    if (!authors.has(id)) authors.set(id, { id, displayName: "Sayly member", avatarUrl: null });
  }
  return authors;
}

// ---- posts ----

export async function findPost(groupId: string, postId: string): Promise<GroupPost | null> {
  const [row] = await db
    .select()
    .from(groupPosts)
    .where(and(eq(groupPosts.id, postId), eq(groupPosts.groupId, groupId)))
    .limit(1);
  return row ?? null;
}

async function findPostByClientId(authorId: string, clientId: string): Promise<GroupPost | null> {
  const [row] = await db
    .select()
    .from(groupPosts)
    .where(and(eq(groupPosts.authorId, authorId), eq(groupPosts.clientId, clientId)))
    .limit(1);
  return row ?? null;
}

/**
 * Inserts a post. With a `clientId` the call is idempotent: a retry returns the stored post
 * (`created: false`), and reusing the key for different content is a conflict for the caller.
 */
export async function insertPost(input: {
  groupId: string;
  authorId: string;
  kind: GroupPostKind;
  body: string;
  clientId: string | null;
}): Promise<{ post: GroupPost; created: boolean }> {
  if (input.clientId) {
    const prior = await findPostByClientId(input.authorId, input.clientId);
    if (prior) return { post: prior, created: false };
  }
  try {
    const [post] = await db.insert(groupPosts).values(input).returning();
    if (!post) throw new Error("Database did not return post");
    return { post, created: true };
  } catch (error) {
    const prior = input.clientId && isUniqueViolation(error) ? await findPostByClientId(input.authorId, input.clientId) : null;
    if (prior) return { post: prior, created: false };
    throw error;
  }
}

/** Newest first, keyset on (createdAt, id). Returns limit + 1 rows so callers know `hasMore`. */
export async function listPosts(groupId: string, before: GroupPost | null, limit: number): Promise<GroupPost[]> {
  return db
    .select()
    .from(groupPosts)
    .where(
      and(
        eq(groupPosts.groupId, groupId),
        before
          ? or(
            lt(groupPosts.createdAt, before.createdAt),
            and(eq(groupPosts.createdAt, before.createdAt), lt(groupPosts.id, before.id)),
          )
          : undefined,
      ),
    )
    .orderBy(desc(groupPosts.createdAt), desc(groupPosts.id))
    .limit(limit + 1);
}

export async function deletePost(postId: string) {
  await db.delete(groupPosts).where(eq(groupPosts.id, postId));
}

// ---- comments ----

export async function findComment(postId: string, commentId: string): Promise<GroupPostComment | null> {
  const [row] = await db
    .select()
    .from(groupPostComments)
    .where(and(eq(groupPostComments.id, commentId), eq(groupPostComments.postId, postId)))
    .limit(1);
  return row ?? null;
}

async function findCommentByClientId(authorId: string, clientId: string): Promise<GroupPostComment | null> {
  const [row] = await db
    .select()
    .from(groupPostComments)
    .where(and(eq(groupPostComments.authorId, authorId), eq(groupPostComments.clientId, clientId)))
    .limit(1);
  return row ?? null;
}

export async function insertComment(input: {
  postId: string;
  authorId: string;
  body: string;
  clientId: string | null;
}): Promise<{ comment: GroupPostComment; created: boolean }> {
  if (input.clientId) {
    const prior = await findCommentByClientId(input.authorId, input.clientId);
    if (prior) return { comment: prior, created: false };
  }
  try {
    const [comment] = await db.insert(groupPostComments).values(input).returning();
    if (!comment) throw new Error("Database did not return comment");
    return { comment, created: true };
  } catch (error) {
    const prior =
      input.clientId && isUniqueViolation(error) ? await findCommentByClientId(input.authorId, input.clientId) : null;
    if (prior) return { comment: prior, created: false };
    throw error;
  }
}

/**
 * The newest `limit` comments older than `before` (or the newest overall), returned oldest
 * first so a thread reads top to bottom. Fetches limit + 1 to tell `hasMore`.
 */
export async function listComments(
  postId: string,
  before: GroupPostComment | null,
  limit: number,
): Promise<GroupPostComment[]> {
  return db
    .select()
    .from(groupPostComments)
    .where(
      and(
        eq(groupPostComments.postId, postId),
        before
          ? or(
            lt(groupPostComments.createdAt, before.createdAt),
            and(eq(groupPostComments.createdAt, before.createdAt), lt(groupPostComments.id, before.id)),
          )
          : undefined,
      ),
    )
    .orderBy(desc(groupPostComments.createdAt), desc(groupPostComments.id))
    .limit(limit + 1);
}

export async function deleteComment(commentId: string) {
  await db.delete(groupPostComments).where(eq(groupPostComments.id, commentId));
}

/** Comment totals for a page of posts in one grouped query. */
export async function loadCommentCounts(postIds: string[]): Promise<Map<string, number>> {
  if (postIds.length === 0) return new Map();
  const rows = await db
    .select({ postId: groupPostComments.postId, value: count() })
    .from(groupPostComments)
    .where(inArray(groupPostComments.postId, postIds))
    .groupBy(groupPostComments.postId);
  return new Map(rows.map((row) => [row.postId, Number(row.value)]));
}

// ---- reactions ----

/** Insert or replace the member's reaction. */
export async function setReaction(postId: string, userId: string, kind: GroupPostReaction) {
  await db
    .insert(groupPostReactions)
    .values({ postId, userId, kind })
    .onConflictDoUpdate({
      target: [groupPostReactions.postId, groupPostReactions.userId],
      set: { kind, createdAt: new Date() },
    });
}

export async function clearReaction(postId: string, userId: string) {
  await db
    .delete(groupPostReactions)
    .where(and(eq(groupPostReactions.postId, postId), eq(groupPostReactions.userId, userId)));
}

/** Per-kind counts for a page of posts, in one grouped query. */
export async function loadReactionTallies(postIds: string[]): Promise<Map<string, ReactionTally>> {
  const tallies = new Map<string, ReactionTally>();
  if (postIds.length === 0) return tallies;
  const rows = await db
    .select({ postId: groupPostReactions.postId, kind: groupPostReactions.kind, value: count() })
    .from(groupPostReactions)
    .where(inArray(groupPostReactions.postId, postIds))
    .groupBy(groupPostReactions.postId, groupPostReactions.kind);
  for (const row of rows) {
    if (!isReaction(row.kind)) continue;
    const tally = tallies.get(row.postId) ?? { counts: emptyReactionCounts(), total: 0 };
    tally.counts[row.kind] = Number(row.value);
    tally.total += Number(row.value);
    tallies.set(row.postId, tally);
  }
  return tallies;
}

/** The viewer's own reaction on each of the given posts. */
export async function loadViewerReactions(
  postIds: string[],
  viewerId: string,
): Promise<Map<string, GroupPostReaction>> {
  if (postIds.length === 0) return new Map();
  const rows = await db
    .select({ postId: groupPostReactions.postId, kind: groupPostReactions.kind })
    .from(groupPostReactions)
    .where(and(inArray(groupPostReactions.postId, postIds), eq(groupPostReactions.userId, viewerId)));
  return new Map(rows.flatMap((row) => (isReaction(row.kind) ? [[row.postId, row.kind] as const] : [])));
}
