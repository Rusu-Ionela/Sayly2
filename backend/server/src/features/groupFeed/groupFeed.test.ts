import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../../shared/middleware/authenticate", () => import("../../test/authMock"));

vi.mock("./repository", () => ({
  loadAuthors: vi.fn(),
  findPost: vi.fn(),
  insertPost: vi.fn(),
  listPosts: vi.fn(),
  deletePost: vi.fn(),
  findComment: vi.fn(),
  insertComment: vi.fn(),
  listComments: vi.fn(),
  deleteComment: vi.fn(),
  loadCommentCounts: vi.fn(),
  setReaction: vi.fn(),
  clearReaction: vi.fn(),
  loadReactionTallies: vi.fn(),
  loadViewerReactions: vi.fn(),
}));
vi.mock("../groups/repository", () => ({
  getGroupAccess: vi.fn(),
  listActiveMemberIds: vi.fn(),
}));
vi.mock("../messaging/gateway", () => ({ emitToUsers: vi.fn() }));
vi.mock("../streaks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../streaks")>()),
  recordActivityInBackground: vi.fn(),
}));

import { GROUP_FEED_EVENTS, emptyReactionCounts } from "@sayly/shared";

import type { GroupPost, GroupPostComment } from "../../db/schema";
import { createApp } from "../../lib/app";
import { TEST_VIEWER_ID } from "../../test/authMock";
import { getGroupAccess, listActiveMemberIds } from "../groups/repository";
import { emitToUsers } from "../messaging/gateway";
import { recordActivityInBackground } from "../streaks";
import * as repository from "./repository";

const repo = vi.mocked(repository);
const app = createApp();
const auth = { Authorization: "Bearer t" };

function post(overrides: Partial<GroupPost> = {}): GroupPost {
  return {
    id: "p1",
    groupId: "g1",
    authorId: TEST_VIEWER_ID,
    kind: "QUESTION",
    body: "How do you say 'cozy' in Spanish?",
    clientId: null,
    createdAt: new Date("2026-10-20T10:00:00Z"),
    ...overrides,
  };
}

function comment(overrides: Partial<GroupPostComment> = {}): GroupPostComment {
  return {
    id: "c1",
    postId: "p1",
    authorId: "other-1",
    body: "Acogedor!",
    clientId: null,
    createdAt: new Date("2026-10-20T10:05:00Z"),
    ...overrides,
  };
}

function asMember(role: "OWNER" | "MODERATOR" | "MEMBER" = "MEMBER") {
  vi.mocked(getGroupAccess).mockResolvedValue({
    group: {} as never,
    membership: { role, status: "ACTIVE" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  asMember();
  vi.mocked(listActiveMemberIds).mockResolvedValue([TEST_VIEWER_ID, "other-1"]);
  repo.loadAuthors.mockImplementation(async (ids) => new Map(ids.map((id) => [id, { id, displayName: id, avatarUrl: null }])));
  repo.loadCommentCounts.mockResolvedValue(new Map());
  repo.loadReactionTallies.mockResolvedValue(new Map());
  repo.loadViewerReactions.mockResolvedValue(new Map());
});

describe("group feed posts", () => {
  it("is members-only", async () => {
    vi.mocked(getGroupAccess).mockResolvedValue({ group: {} as never, membership: null });
    const res = await request(app).get("/groups/g1/posts").set(auth);
    expect(res.status).toBe(403);
    expect(repo.listPosts).not.toHaveBeenCalled();
  });

  it("pages the feed newest first with counts and the viewer's reaction", async () => {
    const rows = [post({ id: "p3" }), post({ id: "p2" }), post({ id: "p1" })];
    repo.listPosts.mockResolvedValue(rows);
    repo.loadCommentCounts.mockResolvedValue(new Map([["p3", 4]]));
    repo.loadReactionTallies.mockResolvedValue(
      new Map([["p3", { counts: { ...emptyReactionCounts(), LOVE: 2 }, total: 2 }]]),
    );
    repo.loadViewerReactions.mockResolvedValue(new Map([["p3", "LOVE" as const]]));

    const res = await request(app).get("/groups/g1/posts?limit=2").set(auth);

    expect(res.status).toBe(200);
    expect(repo.listPosts).toHaveBeenCalledWith("g1", null, 2);
    expect(res.body.items.map((item: { id: string }) => item.id)).toEqual(["p3", "p2"]);
    expect(res.body.hasMore).toBe(true);
    expect(res.body.nextCursor).toBe("p2");
    expect(res.body.items[0]).toMatchObject({ commentCount: 4, reactions: { total: 2, mine: "LOVE" } });
  });

  it("rejects an unknown cursor", async () => {
    repo.findPost.mockResolvedValue(null);
    const res = await request(app).get("/groups/g1/posts?before=nope").set(auth);
    expect(res.status).toBe(400);
  });

  it("creates a post, counts the streak day and pushes it to members", async () => {
    repo.insertPost.mockResolvedValue({ post: post(), created: true });

    const res = await request(app)
      .post("/groups/g1/posts")
      .set(auth)
      .send({ body: "  How do you say 'cozy' in Spanish?  ", kind: "QUESTION" });

    expect(res.status).toBe(201);
    expect(repo.insertPost).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: "g1", authorId: TEST_VIEWER_ID, kind: "QUESTION" }),
    );
    expect(recordActivityInBackground).toHaveBeenCalledWith(TEST_VIEWER_ID);
    expect(emitToUsers).toHaveBeenCalledWith(
      [TEST_VIEWER_ID, "other-1"],
      GROUP_FEED_EVENTS.postNew,
      expect.objectContaining({ id: "p1" }),
    );
  });

  it("returns the stored post for a retried client id without a second broadcast", async () => {
    repo.insertPost.mockResolvedValue({ post: post({ clientId: "client-0001" }), created: false });
    const res = await request(app)
      .post("/groups/g1/posts")
      .set(auth)
      .send({ body: "How do you say 'cozy' in Spanish?", kind: "QUESTION", clientId: "client-0001" });
    expect(res.status).toBe(200);
    expect(emitToUsers).not.toHaveBeenCalled();
  });

  it("rejects a blank post", async () => {
    const res = await request(app).post("/groups/g1/posts").set(auth).send({ body: "   " });
    expect(res.status).toBe(400);
  });

  it("lets only the author or a moderator delete", async () => {
    repo.findPost.mockResolvedValue(post({ authorId: "other-1" }));
    expect((await request(app).delete("/groups/g1/posts/p1").set(auth)).status).toBe(403);

    asMember("MODERATOR");
    const res = await request(app).delete("/groups/g1/posts/p1").set(auth);
    expect(res.status).toBe(204);
    expect(repo.deletePost).toHaveBeenCalledWith("p1");
    expect(emitToUsers).toHaveBeenCalledWith(expect.any(Array), GROUP_FEED_EVENTS.postDeleted, { id: "p1", groupId: "g1" });
  });
});

describe("reactions", () => {
  it("sets a reaction and broadcasts the new counts", async () => {
    repo.findPost.mockResolvedValue(post());
    const res = await request(app).put("/groups/g1/posts/p1/reaction").set(auth).send({ kind: "CLAP" });
    expect(res.status).toBe(200);
    expect(repo.setReaction).toHaveBeenCalledWith("p1", TEST_VIEWER_ID, "CLAP");
    expect(emitToUsers).toHaveBeenCalledWith(expect.any(Array), GROUP_FEED_EVENTS.postUpdated, expect.objectContaining({ id: "p1" }));
  });

  it("clears a reaction", async () => {
    repo.findPost.mockResolvedValue(post());
    const res = await request(app).delete("/groups/g1/posts/p1/reaction").set(auth);
    expect(res.status).toBe(200);
    expect(repo.clearReaction).toHaveBeenCalledWith("p1", TEST_VIEWER_ID);
  });

  it("rejects unknown reaction kinds", async () => {
    const res = await request(app).put("/groups/g1/posts/p1/reaction").set(auth).send({ kind: "ANGRY" });
    expect(res.status).toBe(400);
  });

  it("404s for a post of another group", async () => {
    repo.findPost.mockResolvedValue(null);
    const res = await request(app).put("/groups/g1/posts/p9/reaction").set(auth).send({ kind: "LIKE" });
    expect(res.status).toBe(404);
  });
});

describe("comments", () => {
  it("returns a thread oldest first", async () => {
    repo.findPost.mockResolvedValue(post());
    repo.listComments.mockResolvedValue([comment({ id: "c2" }), comment({ id: "c1" })]);
    const res = await request(app).get("/groups/g1/posts/p1/comments").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.items.map((item: { id: string }) => item.id)).toEqual(["c1", "c2"]);
  });

  it("adds a comment and pushes it with the new count", async () => {
    repo.findPost.mockResolvedValue(post());
    repo.insertComment.mockResolvedValue({ comment: comment({ authorId: TEST_VIEWER_ID }), created: true });
    repo.loadCommentCounts.mockResolvedValue(new Map([["p1", 3]]));

    const res = await request(app).post("/groups/g1/posts/p1/comments").set(auth).send({ body: "Acogedor!" });

    expect(res.status).toBe(201);
    expect(emitToUsers).toHaveBeenCalledWith(
      expect.any(Array),
      GROUP_FEED_EVENTS.commentNew,
      expect.objectContaining({ id: "c1", postId: "p1", commentCount: 3 }),
    );
  });

  it("lets the author delete their comment", async () => {
    repo.findPost.mockResolvedValue(post({ authorId: "other-1" }));
    repo.findComment.mockResolvedValue(comment({ authorId: TEST_VIEWER_ID }));
    const res = await request(app).delete("/groups/g1/posts/p1/comments/c1").set(auth);
    expect(res.status).toBe(204);
    expect(repo.deleteComment).toHaveBeenCalledWith("c1");
  });
});
