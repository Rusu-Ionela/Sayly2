import {
  emptyReactionCounts,
  GROUP_FEED_EVENTS,
  GROUP_POST_KINDS,
  type GroupCommentDeletedEvent,
  type GroupCommentDto,
  type GroupCommentNewEvent,
  type GroupCommentsPage,
  type GroupFeedPageQuery,
  type GroupPostDeletedEvent,
  type GroupPostDto,
  type GroupPostKind,
  type GroupPostReaction,
  type GroupPostsPage,
  type GroupPostUpdatedEvent,
} from "@sayly/shared";

import type { GroupPost, GroupPostComment } from "../../db/schema";
import { AppError } from "../../shared/errors/AppError";
import { assertCanReadContent, type Membership } from "../groups/policy";
import { getGroupAccess, listActiveMemberIds } from "../groups/repository";
import { emitToUsers } from "../messaging/gateway";
import { recordActivityInBackground } from "../streaks";

import { assertCanDelete } from "./policy";
import * as repository from "./repository";

const isPostKind = (value: string): value is GroupPostKind =>
  (GROUP_POST_KINDS as readonly string[]).includes(value);

/** Every feed route: the group must exist and the viewer must be an active member. */
async function requireMember(groupId: string, userId: string): Promise<Membership> {
  const { membership } = await getGroupAccess(groupId, userId);
  assertCanReadContent(membership);
  return membership;
}

async function requirePost(groupId: string, postId: string): Promise<GroupPost> {
  const post = await repository.findPost(groupId, postId);
  if (!post) {
    throw new AppError("Post not found", 404, "NOT_FOUND");
  }
  return post;
}

/** Fan-out to the group's active members; re-read per event so removed members stop receiving. */
async function broadcast(groupId: string, event: string, payload: unknown) {
  emitToUsers(await listActiveMemberIds(groupId), event, payload);
}

async function toPostDtos(posts: GroupPost[], viewerId: string): Promise<GroupPostDto[]> {
  const ids = posts.map((post) => post.id);
  const [authors, commentCounts, tallies, mine] = await Promise.all([
    repository.loadAuthors(posts.map((post) => post.authorId)),
    repository.loadCommentCounts(ids),
    repository.loadReactionTallies(ids),
    repository.loadViewerReactions(ids, viewerId),
  ]);
  return posts.map((post) => {
    const tally = tallies.get(post.id) ?? { counts: emptyReactionCounts(), total: 0 };
    return {
      id: post.id,
      groupId: post.groupId,
      kind: isPostKind(post.kind) ? post.kind : "THOUGHT",
      body: post.body,
      author: authors.get(post.authorId)!,
      commentCount: commentCounts.get(post.id) ?? 0,
      reactions: { ...tally, mine: mine.get(post.id) ?? null },
      createdAt: post.createdAt.toISOString(),
      clientId: post.clientId,
    };
  });
}

async function toCommentDtos(groupId: string, comments: GroupPostComment[]): Promise<GroupCommentDto[]> {
  const authors = await repository.loadAuthors(comments.map((comment) => comment.authorId));
  return comments.map((comment) => ({
    id: comment.id,
    postId: comment.postId,
    groupId,
    body: comment.body,
    author: authors.get(comment.authorId)!,
    createdAt: comment.createdAt.toISOString(),
    clientId: comment.clientId,
  }));
}

/** Counts after a reaction or comment change, for everyone's open feed. */
async function postCounts(post: GroupPost): Promise<GroupPostUpdatedEvent> {
  const [commentCounts, tallies] = await Promise.all([
    repository.loadCommentCounts([post.id]),
    repository.loadReactionTallies([post.id]),
  ]);
  return {
    id: post.id,
    groupId: post.groupId,
    commentCount: commentCounts.get(post.id) ?? 0,
    reactions: tallies.get(post.id) ?? { counts: emptyReactionCounts(), total: 0 },
  };
}

// ---- posts ----

export async function listPosts(viewerId: string, groupId: string, query: GroupFeedPageQuery): Promise<GroupPostsPage> {
  await requireMember(groupId, viewerId);
  const anchor = query.before ? await repository.findPost(groupId, query.before) : null;
  if (query.before && !anchor) {
    throw new AppError("Invalid cursor", 400, "VALIDATION_ERROR");
  }
  const rows = await repository.listPosts(groupId, anchor, query.limit);
  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  return {
    items: await toPostDtos(page, viewerId),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    hasMore,
  };
}

export async function getPost(viewerId: string, groupId: string, postId: string): Promise<GroupPostDto> {
  await requireMember(groupId, viewerId);
  const [dto] = await toPostDtos([await requirePost(groupId, postId)], viewerId);
  return dto!;
}

export async function createPost(
  userId: string,
  groupId: string,
  input: { body: string; kind: GroupPostKind; clientId?: string },
): Promise<{ post: GroupPostDto; created: boolean }> {
  await requireMember(groupId, userId);
  const { post, created } = await repository.insertPost({
    groupId,
    authorId: userId,
    kind: input.kind,
    body: input.body,
    clientId: input.clientId ?? null,
  });
  if (!created && (post.groupId !== groupId || post.body !== input.body)) {
    throw new AppError("Idempotency key reused for different input", 409, "CONFLICT");
  }
  const [dto] = await toPostDtos([post], userId);
  if (created) {
    recordActivityInBackground(userId);
    // Others see it with no reaction of their own yet.
    await broadcast(groupId, GROUP_FEED_EVENTS.postNew, { ...dto!, reactions: { ...dto!.reactions, mine: null } });
  }
  return { post: dto!, created };
}

export async function deletePost(userId: string, groupId: string, postId: string) {
  const membership = await requireMember(groupId, userId);
  const post = await requirePost(groupId, postId);
  assertCanDelete(userId, post.authorId, membership);
  await repository.deletePost(post.id);
  const event: GroupPostDeletedEvent = { id: post.id, groupId };
  await broadcast(groupId, GROUP_FEED_EVENTS.postDeleted, event);
}

// ---- reactions ----

export async function setReaction(
  userId: string,
  groupId: string,
  postId: string,
  kind: GroupPostReaction | null,
): Promise<GroupPostDto> {
  await requireMember(groupId, userId);
  const post = await requirePost(groupId, postId);
  if (kind) {
    await repository.setReaction(post.id, userId, kind);
  } else {
    await repository.clearReaction(post.id, userId);
  }
  await broadcast(groupId, GROUP_FEED_EVENTS.postUpdated, await postCounts(post));
  const [dto] = await toPostDtos([post], userId);
  return dto!;
}

// ---- comments ----

export async function listComments(
  viewerId: string,
  groupId: string,
  postId: string,
  query: GroupFeedPageQuery,
): Promise<GroupCommentsPage> {
  await requireMember(groupId, viewerId);
  const post = await requirePost(groupId, postId);
  const anchor = query.before ? await repository.findComment(post.id, query.before) : null;
  if (query.before && !anchor) {
    throw new AppError("Invalid cursor", 400, "VALIDATION_ERROR");
  }
  const rows = await repository.listComments(post.id, anchor, query.limit);
  const hasMore = rows.length > query.limit;
  const page = (hasMore ? rows.slice(0, query.limit) : rows).reverse();
  return {
    items: await toCommentDtos(groupId, page),
    nextCursor: hasMore ? (page[0]?.id ?? null) : null,
    hasMore,
  };
}

export async function createComment(
  userId: string,
  groupId: string,
  postId: string,
  input: { body: string; clientId?: string },
): Promise<{ comment: GroupCommentDto; created: boolean }> {
  await requireMember(groupId, userId);
  const post = await requirePost(groupId, postId);
  const { comment, created } = await repository.insertComment({
    postId: post.id,
    authorId: userId,
    body: input.body,
    clientId: input.clientId ?? null,
  });
  if (!created && (comment.postId !== post.id || comment.body !== input.body)) {
    throw new AppError("Idempotency key reused for different input", 409, "CONFLICT");
  }
  const [dto] = await toCommentDtos(groupId, [comment]);
  if (created) {
    recordActivityInBackground(userId);
    const counts = await postCounts(post);
    const event: GroupCommentNewEvent = { ...dto!, commentCount: counts.commentCount };
    await broadcast(groupId, GROUP_FEED_EVENTS.commentNew, event);
  }
  return { comment: dto!, created };
}

export async function deleteComment(userId: string, groupId: string, postId: string, commentId: string) {
  const membership = await requireMember(groupId, userId);
  const post = await requirePost(groupId, postId);
  const comment = await repository.findComment(post.id, commentId);
  if (!comment) {
    throw new AppError("Comment not found", 404, "NOT_FOUND");
  }
  assertCanDelete(userId, comment.authorId, membership);
  await repository.deleteComment(comment.id);
  const counts = await postCounts(post);
  const event: GroupCommentDeletedEvent = {
    id: comment.id,
    postId: post.id,
    groupId,
    commentCount: counts.commentCount,
  };
  await broadcast(groupId, GROUP_FEED_EVENTS.commentDeleted, event);
}
