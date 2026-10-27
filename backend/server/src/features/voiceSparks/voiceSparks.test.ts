import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../../shared/middleware/authenticate", () => import("../../test/authMock"));

vi.mock("./repository", () => ({
  insertSpark: vi.fn(),
  findLiveSpark: vi.fn(),
  countLiveOwnSparks: vi.fn(),
  findLatestOwnSpark: vi.fn(),
  countLiveReplies: vi.fn(),
  viewerLanguageIds: vi.fn(),
  listFeed: vi.fn(),
  listRepliesTo: vi.fn(),
  deleteOwnSpark: vi.fn(),
  deleteExpiredSparks: vi.fn(),
}));

vi.mock("../media/service", () => ({
  findOwnedAsset: vi.fn(),
  reclaimOwnerMedia: vi.fn(),
}));

vi.mock("../safety/repository", () => ({ isBlockedEitherWay: vi.fn() }));

vi.mock("../messaging/gateway", () => ({ emitToUsers: vi.fn() }));

vi.mock("../streaks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../streaks")>()),
  recordActivityInBackground: vi.fn(),
}));

import { createApp } from "../../lib/app";
import { findOwnedAsset, reclaimOwnerMedia } from "../media/service";
import { emitToUsers } from "../messaging/gateway";
import { isBlockedEitherWay } from "../safety/repository";
import { recordActivityInBackground } from "../streaks";
import * as repository from "./repository";
import { MAX_LIVE_SPARKS, sweepExpiredSparks } from "./service";

const repo = vi.mocked(repository);
const app = createApp();
const auth = { Authorization: "Bearer t" };

function sparkRow(overrides: Partial<repository.SparkRow> = {}): repository.SparkRow {
  return {
    id: "s1",
    userId: "viewer-1",
    languageId: "es",
    audioUrl: "/media/files/abc123.m4a",
    durationMs: 9000,
    replyToId: null,
    replyToUserId: null,
    createdAt: new Date("2026-10-27T08:00:00Z"),
    expiresAt: new Date("2026-10-28T08:00:00Z"),
    displayName: "Viewer",
    profileImageUrl: null,
    languageName: "Spanish",
    flagEmoji: "🇪🇸",
    ...overrides,
  };
}

const audioAsset = { storageKey: "abc123.m4a", mimeType: "audio/mp4", size: 120_000 };

function post(body: Record<string, unknown>) {
  return request(app).post("/voicesparks").set(auth).send(body);
}

describe("voice spark routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.countLiveOwnSparks.mockResolvedValue(0);
    repo.insertSpark.mockResolvedValue("s1");
    repo.findLiveSpark.mockResolvedValue(sparkRow());
    vi.mocked(findOwnedAsset).mockResolvedValue(audioAsset);
    vi.mocked(isBlockedEitherWay).mockResolvedValue(false);
  });

  it("posts a spark that lives 24 hours and counts the streak day", async () => {
    const res = await post({ audioUrl: "/media/files/abc123.m4a?exp=1&sig=x", durationMs: 9000, languageId: "ES" });

    expect(res.status).toBe(201);
    const values = repo.insertSpark.mock.calls[0]?.[0];
    expect(values).toMatchObject({ userId: "viewer-1", languageId: "es", audioUrl: "/media/files/abc123.m4a" });
    expect(values && values.expiresAt.getTime() - values.createdAt.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(res.body.audioUrl).toMatch(/^\/media\/files\/abc123\.m4a\?exp=\d+&sig=/);
    expect(recordActivityInBackground).toHaveBeenCalledWith("viewer-1");
  });

  it("rejects notes longer than 15 seconds, and files that are not audio", async () => {
    const tooLong = await post({ audioUrl: "/media/files/abc123.m4a", durationMs: 15_001, languageId: "es" });
    expect(tooLong.status).toBe(400);

    vi.mocked(findOwnedAsset).mockResolvedValue({ ...audioAsset, mimeType: "image/png" });
    const image = await post({ audioUrl: "/media/files/abc123.png", durationMs: 5000, languageId: "es" });
    expect(image.status).toBe(400);
    expect(repo.insertSpark).not.toHaveBeenCalled();
  });

  it("caps live sparks per member", async () => {
    repo.countLiveOwnSparks.mockResolvedValue(MAX_LIVE_SPARKS);
    const res = await post({ audioUrl: "/media/files/abc123.m4a", durationMs: 5000, languageId: "es" });
    expect(res.status).toBe(409);
  });

  it("sends a voice reply privately to the author of the spark", async () => {
    repo.findLiveSpark
      .mockResolvedValueOnce(sparkRow({ id: "other", userId: "author-1" }))
      .mockResolvedValueOnce(sparkRow({ id: "s2", replyToId: "other", replyToUserId: "author-1" }));
    repo.insertSpark.mockResolvedValue("s2");

    const res = await post({ audioUrl: "/media/files/abc123.m4a", durationMs: 4000, languageId: "es", replyToId: "other" });

    expect(res.status).toBe(201);
    expect(repo.insertSpark).toHaveBeenCalledWith(
      expect.objectContaining({ replyToId: "other", replyToUserId: "author-1" }),
    );
    expect(repo.countLiveOwnSparks).not.toHaveBeenCalled();
    expect(emitToUsers).toHaveBeenCalledWith(["author-1"], "voice_spark_reply", expect.objectContaining({ id: "s2" }));
  });

  it("does not reply to your own spark or across a block", async () => {
    repo.findLiveSpark.mockResolvedValue(sparkRow({ id: "mine", userId: "viewer-1" }));
    const own = await post({ audioUrl: "/media/files/abc123.m4a", durationMs: 4000, languageId: "es", replyToId: "mine" });
    expect(own.status).toBe(400);

    repo.findLiveSpark.mockResolvedValue(sparkRow({ id: "other", userId: "author-1" }));
    vi.mocked(isBlockedEitherWay).mockResolvedValue(true);
    const blocked = await post({
      audioUrl: "/media/files/abc123.m4a",
      durationMs: 4000,
      languageId: "es",
      replyToId: "other",
    });
    expect(blocked.status).toBe(404);
    expect(repo.insertSpark).not.toHaveBeenCalled();
  });

  it("returns my spark with its reply count, the sparks of others and replies to me", async () => {
    repo.viewerLanguageIds.mockResolvedValue(["es", "en"]);
    repo.findLatestOwnSpark.mockResolvedValue(sparkRow());
    repo.countLiveReplies.mockResolvedValue(2);
    repo.listFeed.mockResolvedValue([sparkRow({ id: "o1", userId: "u1", displayName: "Ana" })]);
    repo.listRepliesTo.mockResolvedValue([sparkRow({ id: "r1", userId: "u2", replyToId: "s1" })]);

    const res = await request(app).get("/voicesparks/feed").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.mine).toMatchObject({ id: "s1", replyCount: 2 });
    expect(res.body.items).toEqual([
      expect.objectContaining({ id: "o1", author: expect.objectContaining({ displayName: "Ana" }) }),
    ]);
    expect(res.body.replies).toEqual([expect.objectContaining({ id: "r1", replyToId: "s1" })]);
    expect(repo.listFeed).toHaveBeenCalledWith("viewer-1", ["es", "en"], expect.any(Date), 30);
  });

  it("sweeps expired sparks and frees their audio", async () => {
    repo.deleteExpiredSparks.mockResolvedValue(["u1", "u2"]);
    vi.mocked(reclaimOwnerMedia).mockResolvedValue(undefined);
    expect(await sweepExpiredSparks()).toBe(2);
    expect(reclaimOwnerMedia).toHaveBeenCalledTimes(2);
  });
});
