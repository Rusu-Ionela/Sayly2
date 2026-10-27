import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../../shared/middleware/authenticate", () => import("../../test/authMock"));

vi.mock("./repository", () => ({
  insertStory: vi.fn(),
  countLiveOwnStories: vi.fn(),
  findOwnStory: vi.fn(),
  findVisibleStory: vi.fn(),
  listOwnLiveStories: vi.fn(),
  listFeedStories: vi.fn(),
  deleteOwnStory: vi.fn(),
  deleteExpiredStories: vi.fn(),
}));

vi.mock("../media/service", () => ({
  findOwnedAsset: vi.fn(),
  reclaimOwnerMedia: vi.fn(),
}));

vi.mock("../messaging/service", () => ({
  getOrCreateDirectConversation: vi.fn(),
  sendMessage: vi.fn(),
}));

vi.mock("../messaging/gateway", () => ({ emitNewMessage: vi.fn() }));
vi.mock("../messaging/socket", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../messaging/socket")>()),
  promoteDelivered: vi.fn(),
}));
vi.mock("../notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../notifications")>()),
  notifyNewMessage: vi.fn(),
}));

vi.mock("../streaks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../streaks")>()),
  recordActivityInBackground: vi.fn(),
}));

import { STORY_MAX_LIVE } from "@sayly/shared";

import { createApp } from "../../lib/app";
import { AppError } from "../../shared/errors/AppError";
import { findOwnedAsset, reclaimOwnerMedia } from "../media/service";
import { emitNewMessage } from "../messaging/gateway";
import * as messagingService from "../messaging/service";
import { notifyNewMessage } from "../notifications";
import { recordActivityInBackground } from "../streaks";
import * as repository from "./repository";
import { sweepExpiredStories } from "./service";

const repo = vi.mocked(repository);
const messaging = vi.mocked(messagingService);
const app = createApp();
const auth = { Authorization: "Bearer t" };

function storyRow(overrides: Partial<repository.StoryRow> = {}): repository.StoryRow {
  return {
    id: "st1",
    userId: "viewer-1",
    mediaType: "TEXT",
    mediaUrl: null,
    textContent: "¡Hola a todos!",
    durationMs: null,
    targetLanguage: "es",
    createdAt: new Date("2026-10-27T08:00:00Z"),
    expiresAt: new Date("2026-10-28T08:00:00Z"),
    displayName: "Viewer",
    profileImageUrl: null,
    languageName: "Spanish",
    flagEmoji: "🇪🇸",
    ...overrides,
  };
}

const photoAsset = { storageKey: "abc123.jpg", mimeType: "image/jpeg", size: 400_000 };

function post(body: Record<string, unknown>) {
  return request(app).post("/stories").set(auth).send(body);
}

describe("story routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.countLiveOwnStories.mockResolvedValue(0);
    repo.insertStory.mockResolvedValue("st1");
    repo.findOwnStory.mockResolvedValue(storyRow());
    vi.mocked(findOwnedAsset).mockResolvedValue(photoAsset);
  });

  it("posts a text story that lives 24 hours and counts the streak day", async () => {
    const res = await post({ mediaType: "TEXT", textContent: "¡Hola a todos!", targetLanguage: "ES" });

    expect(res.status).toBe(201);
    const values = repo.insertStory.mock.calls[0]?.[0];
    expect(values).toMatchObject({ userId: "viewer-1", mediaType: "TEXT", mediaUrl: null, targetLanguage: "es" });
    expect(values && values.expiresAt.getTime() - values.createdAt.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(res.body).toMatchObject({ id: "st1", mediaType: "TEXT", textContent: "¡Hola a todos!" });
    expect(recordActivityInBackground).toHaveBeenCalledWith("viewer-1");
  });

  it("stores the stable path of an owned photo and signs it on the way out", async () => {
    repo.findOwnStory.mockResolvedValue(storyRow({ mediaType: "PHOTO", mediaUrl: "/media/files/abc123.jpg" }));

    const res = await post({
      mediaType: "PHOTO",
      mediaUrl: "/media/files/abc123.jpg?exp=1&sig=x",
      textContent: "Mi café",
      targetLanguage: "es",
    });

    expect(res.status).toBe(201);
    expect(repo.insertStory).toHaveBeenCalledWith(
      expect.objectContaining({ mediaUrl: "/media/files/abc123.jpg", textContent: "Mi café" }),
    );
    expect(res.body.mediaUrl).toMatch(/^\/media\/files\/abc123\.jpg\?exp=\d+&sig=/);
  });

  it("rejects a voice story whose file is not audio, and payloads of the wrong shape", async () => {
    const notAudio = await post({
      mediaType: "VOICE",
      mediaUrl: "/media/files/abc123.jpg",
      durationMs: 5000,
      targetLanguage: "es",
    });
    expect(notAudio.status).toBe(400);

    const textWithMedia = await post({
      mediaType: "TEXT",
      textContent: "hi",
      mediaUrl: "/media/files/abc123.jpg",
      targetLanguage: "es",
    });
    expect(textWithMedia.status).toBe(400);

    const tooLong = await post({
      mediaType: "VOICE",
      mediaUrl: "/media/files/a.m4a",
      durationMs: 30_001,
      targetLanguage: "es",
    });
    expect(tooLong.status).toBe(400);
    expect(repo.insertStory).not.toHaveBeenCalled();
  });

  it("caps live stories per member", async () => {
    repo.countLiveOwnStories.mockResolvedValue(STORY_MAX_LIVE);
    const res = await post({ mediaType: "TEXT", textContent: "hi", targetLanguage: "es" });
    expect(res.status).toBe(409);
  });

  it("groups the feed by author, latest poster first, stories oldest first", async () => {
    repo.listOwnLiveStories.mockResolvedValue([storyRow()]);
    repo.listFeedStories.mockResolvedValue([
      storyRow({ id: "a1", userId: "ana", displayName: "Ana", createdAt: new Date("2026-10-27T07:00:00Z") }),
      storyRow({ id: "b1", userId: "bo", displayName: "Bo", createdAt: new Date("2026-10-27T08:00:00Z") }),
      storyRow({ id: "a2", userId: "ana", displayName: "Ana", createdAt: new Date("2026-10-27T09:00:00Z") }),
    ]);

    const res = await request(app).get("/stories/feed").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.mine.stories).toEqual([expect.objectContaining({ id: "st1" })]);
    expect(res.body.groups.map((group: { author: { id: string } }) => group.author.id)).toEqual(["ana", "bo"]);
    expect(res.body.groups[0].stories.map((story: { id: string }) => story.id)).toEqual(["a1", "a2"]);
  });

  it("returns mine as null when the viewer has no live stories", async () => {
    repo.listOwnLiveStories.mockResolvedValue([]);
    repo.listFeedStories.mockResolvedValue([]);
    const res = await request(app).get("/stories/feed").set(auth);
    expect(res.body).toEqual({ mine: null, groups: [] });
  });

  it("sends a reply into the private chat with the author", async () => {
    repo.findVisibleStory.mockResolvedValue(storyRow({ id: "ana-1", userId: "ana" }));
    messaging.getOrCreateDirectConversation.mockResolvedValue({ conversationId: "c1", created: false });
    const message = { id: "m1", conversationId: "c1" };
    messaging.sendMessage.mockResolvedValue({
      message: message as never,
      recipientId: "ana",
      created: true,
    });

    const res = await request(app).post("/stories/ana-1/reply").set(auth).send({ text: "¡Qué bien!" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ conversationId: "c1", messageId: "m1" });
    expect(messaging.getOrCreateDirectConversation).toHaveBeenCalledWith("viewer-1", "ana");
    expect(messaging.sendMessage).toHaveBeenCalledWith("viewer-1", {
      conversationId: "c1",
      type: "TEXT",
      content: "↪ Replied to your story: “¡Hola a todos!”\n¡Qué bien!",
      clientMessageId: undefined,
    });
    expect(emitNewMessage).toHaveBeenCalledWith(message, "ana");
    expect(notifyNewMessage).toHaveBeenCalledWith(message, "ana");
  });

  it("does not reply to an expired or hidden story, nor to your own", async () => {
    repo.findVisibleStory.mockResolvedValue(null);
    const hidden = await request(app).post("/stories/x/reply").set(auth).send({ text: "hi" });
    expect(hidden.status).toBe(404);

    repo.findVisibleStory.mockResolvedValue(storyRow({ userId: "viewer-1" }));
    const own = await request(app).post("/stories/st1/reply").set(auth).send({ text: "hi" });
    expect(own.status).toBe(400);
    expect(messaging.sendMessage).not.toHaveBeenCalled();
  });

  it("passes on the connection rule when no chat exists yet", async () => {
    repo.findVisibleStory.mockResolvedValue(storyRow({ userId: "ana" }));
    messaging.getOrCreateDirectConversation.mockRejectedValue(
      new AppError("Accept a connection request before starting a chat", 403, "CONNECTION_REQUIRED"),
    );
    const res = await request(app).post("/stories/st1/reply").set(auth).send({ text: "hi" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("CONNECTION_REQUIRED");
  });

  it("deletes only your own story", async () => {
    repo.deleteOwnStory.mockResolvedValue(false);
    const res = await request(app).delete("/stories/st1").set(auth);
    expect(res.status).toBe(404);
    expect(repo.deleteOwnStory).toHaveBeenCalledWith("viewer-1", "st1");
  });

  it("sweeps expired stories and frees their media", async () => {
    repo.deleteExpiredStories.mockResolvedValue(["u1", "u2"]);
    vi.mocked(reclaimOwnerMedia).mockResolvedValue(undefined);
    expect(await sweepExpiredStories()).toBe(2);
    expect(reclaimOwnerMedia).toHaveBeenCalledTimes(2);
  });
});
