import { emptyReactionCounts } from "@sayly/shared";

import {
  applyPostCounts,
  flattenComments,
  flattenPosts,
  removePost,
  toggleReaction,
  upsertComment,
  upsertPost,
  type CommentPages,
  type FeedComment,
  type FeedPages,
  type FeedPost,
} from "./feedModel";

function post(id: string, overrides: Partial<FeedPost> = {}): FeedPost {
  return {
    id,
    groupId: "g1",
    kind: "THOUGHT",
    body: "hello",
    author: { id: "u1", displayName: "Anya", avatarUrl: null },
    commentCount: 0,
    reactions: { counts: emptyReactionCounts(), total: 0, mine: null },
    createdAt: "2026-10-20T10:00:00.000Z",
    clientId: null,
    ...overrides,
  };
}

function comment(id: string, overrides: Partial<FeedComment> = {}): FeedComment {
  return {
    id,
    postId: "p1",
    groupId: "g1",
    body: "nice",
    author: { id: "u2", displayName: "Ben", avatarUrl: null },
    createdAt: "2026-10-20T10:00:00.000Z",
    clientId: null,
    ...overrides,
  };
}

const feed = (...pages: FeedPost[][]): FeedPages => ({
  pages: pages.map((items) => ({ items, nextCursor: null, hasMore: false })),
  pageParams: pages.map(() => undefined),
});

describe("feed posts", () => {
  it("puts a new post on top", () => {
    const next = upsertPost(feed([post("p1")], [post("p0")]), post("p2"));
    expect(flattenPosts(next).map((item) => item.id)).toEqual(["p2", "p1", "p0"]);
  });

  it("swaps the optimistic card for the server copy by client id", () => {
    const optimistic = post("client-1", { clientId: "client-1", localState: "sending" });
    const next = upsertPost(feed([optimistic]), post("p9", { clientId: "client-1" }));
    const posts = flattenPosts(next);
    expect(posts.map((item) => item.id)).toEqual(["p9"]);
    expect(posts[0]?.localState).toBeUndefined();
  });

  it("keeps the viewer's reaction when a broadcast copy arrives", () => {
    const mine = post("p1", {
      reactions: { counts: { ...emptyReactionCounts(), LIKE: 1 }, total: 1, mine: "LIKE" },
    });
    const next = upsertPost(feed([mine]), post("p1"), true);
    expect(flattenPosts(next)[0]?.reactions.mine).toBe("LIKE");
  });

  it("removes a deleted post from any page", () => {
    expect(
      flattenPosts(removePost(feed([post("p2")], [post("p1")]), "p1")).map((item) => item.id),
    ).toEqual(["p2"]);
  });

  it("applies broadcast counts without touching the viewer's reaction", () => {
    const mine = post("p1", {
      reactions: { counts: emptyReactionCounts(), total: 0, mine: "CLAP" },
    });
    const next = applyPostCounts(mine, {
      id: "p1",
      commentCount: 5,
      reactions: { counts: { ...emptyReactionCounts(), CLAP: 3 }, total: 3 },
    });
    expect(next).toMatchObject({ commentCount: 5, reactions: { total: 3, mine: "CLAP" } });
  });
});

describe("toggleReaction", () => {
  const none = { counts: emptyReactionCounts(), total: 0, mine: null };

  it("adds, switches and removes the viewer's reaction", () => {
    const liked = toggleReaction(none, "LIKE");
    expect(liked).toMatchObject({
      sent: "LIKE",
      next: { total: 1, mine: "LIKE", counts: { LIKE: 1 } },
    });

    const loved = toggleReaction(liked.next, "LOVE");
    expect(loved).toMatchObject({ sent: "LOVE", next: { total: 1, counts: { LIKE: 0, LOVE: 1 } } });

    const cleared = toggleReaction(loved.next, "LOVE");
    expect(cleared).toMatchObject({ sent: null, next: { total: 0, mine: null } });
  });
});

describe("comments", () => {
  it("appends to the newest page and reads oldest to newest", () => {
    const data: CommentPages = {
      pages: [
        { items: [comment("c2")], nextCursor: "c2", hasMore: true },
        { items: [comment("c1")], nextCursor: null, hasMore: false },
      ],
      pageParams: [undefined, "c2"],
    };
    const next = upsertComment(data, comment("c3"));
    expect(flattenComments(next).map((item) => item.id)).toEqual(["c1", "c2", "c3"]);
  });
});
