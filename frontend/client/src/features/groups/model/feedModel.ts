import type {
  GroupCommentDto,
  GroupCommentsPage,
  GroupPostDto,
  GroupPostReaction,
  GroupPostReactionSummary,
  GroupPostsPage,
  GroupPostUpdatedEvent,
} from "@sayly/shared";

/** A post or comment as the app holds it: server data plus the state of an optimistic send. */
type LocalSendState = "sending" | "failed";
export type FeedPost = GroupPostDto & { localState?: LocalSendState };
export type FeedComment = GroupCommentDto & { localState?: LocalSendState };

export type FeedPages = {
  pages: (Omit<GroupPostsPage, "items"> & { items: FeedPost[] })[];
  pageParams: unknown[];
};
export type CommentPages = {
  pages: (Omit<GroupCommentsPage, "items"> & { items: FeedComment[] })[];
  pageParams: unknown[];
};

const samePost = (a: FeedPost, b: FeedPost) =>
  a.id === b.id || Boolean(b.clientId && a.clientId === b.clientId);

/** Pages are [newest, older…], each newest first. */
export function flattenPosts(data: FeedPages | undefined): FeedPost[] {
  return data?.pages.flatMap((page) => page.items) ?? [];
}

/**
 * Inserts a post at the top, or replaces the same post (server id or client id), so an
 * optimistic card turns into the real one instead of showing twice.
 * `keepMine` keeps the viewer's own reaction when the incoming copy comes from a broadcast.
 */
export function upsertPost(
  data: FeedPages | undefined,
  post: FeedPost,
  keepMine = false,
): FeedPages | undefined {
  if (!data) return data;
  const exists = data.pages.some((page) => page.items.some((item) => samePost(item, post)));
  const pages = data.pages.map((page, index) => {
    if (exists) {
      return {
        ...page,
        items: page.items.map((item) =>
          samePost(item, post)
            ? {
                ...post,
                reactions: keepMine
                  ? { ...post.reactions, mine: item.reactions.mine }
                  : post.reactions,
              }
            : item,
        ),
      };
    }
    return index === 0 ? { ...page, items: [post, ...page.items] } : page;
  });
  return { ...data, pages };
}

export function removePost(data: FeedPages | undefined, postId: string): FeedPages | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.filter((item) => item.id !== postId),
    })),
  };
}

/** Applies counts from a broadcast; the viewer's own reaction is local knowledge and stays. */
export function applyPostCounts<T extends Pick<FeedPost, "id" | "commentCount" | "reactions">>(
  post: T,
  event: Pick<GroupPostUpdatedEvent, "id" | "commentCount"> & {
    reactions?: GroupPostUpdatedEvent["reactions"];
  },
): T {
  if (post.id !== event.id) return post;
  return {
    ...post,
    commentCount: event.commentCount,
    reactions: event.reactions ? { ...event.reactions, mine: post.reactions.mine } : post.reactions,
  };
}

export function mapPosts(
  data: FeedPages | undefined,
  fn: (post: FeedPost) => FeedPost,
): FeedPages | undefined {
  if (!data) return data;
  return { ...data, pages: data.pages.map((page) => ({ ...page, items: page.items.map(fn) })) };
}

/** Optimistic reaction change: picking your current reaction again removes it. */
export function toggleReaction(
  summary: GroupPostReactionSummary,
  kind: GroupPostReaction,
): { next: GroupPostReactionSummary; sent: GroupPostReaction | null } {
  const counts = { ...summary.counts };
  let total = summary.total;
  if (summary.mine) {
    counts[summary.mine] = Math.max(0, counts[summary.mine] - 1);
    total = Math.max(0, total - 1);
  }
  const sent = summary.mine === kind ? null : kind;
  if (sent) {
    counts[sent] += 1;
    total += 1;
  }
  return { next: { counts, total, mine: sent }, sent };
}

// ---- comments ----

const sameComment = (a: FeedComment, b: FeedComment) =>
  a.id === b.id || Boolean(b.clientId && a.clientId === b.clientId);

/** Comment pages are [newest, older…], each oldest first — flatten to read top to bottom. */
export function flattenComments(data: CommentPages | undefined): FeedComment[] {
  if (!data) return [];
  return [...data.pages].reverse().flatMap((page) => page.items);
}

export function upsertComment(
  data: CommentPages | undefined,
  comment: FeedComment,
): CommentPages | undefined {
  if (!data) return data;
  const exists = data.pages.some((page) => page.items.some((item) => sameComment(item, comment)));
  const pages = data.pages.map((page, index) => {
    if (exists)
      return {
        ...page,
        items: page.items.map((item) => (sameComment(item, comment) ? comment : item)),
      };
    return index === 0 ? { ...page, items: [...page.items, comment] } : page;
  });
  return { ...data, pages };
}

export function removeComment(
  data: CommentPages | undefined,
  commentId: string,
): CommentPages | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.filter((item) => item.id !== commentId),
    })),
  };
}
