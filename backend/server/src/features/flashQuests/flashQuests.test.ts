import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../../shared/middleware/authenticate", () => import("../../test/authMock"));

vi.mock("./repository", () => ({
  findQuestFor: vi.fn(),
  findOpenQuestFor: vi.fn(),
  matchOrCreate: vi.fn(),
  joinOlderSearch: vi.fn(),
  cancelQuest: vi.fn(),
  setWantsConnect: vi.fn(),
  listMessages: vi.fn(),
  countMessages: vi.fn(),
  insertMessage: vi.fn(),
  languageName: vi.fn(),
  pruneOldFlashQuests: vi.fn(),
}));

vi.mock("../connections/repository", () => ({ requestConnection: vi.fn() }));
vi.mock("../messaging/gateway", () => ({ emitToUsers: vi.fn() }));
vi.mock("../users/memberSummary", () => ({ loadMemberSummaries: vi.fn() }));
vi.mock("../streaks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../streaks")>()),
  recordActivityInBackground: vi.fn(),
}));

import { FLASH_QUEST_DURATION_MS, FLASH_QUEST_SEARCH_TIMEOUT_MS } from "@sayly/shared";

import type { FlashQuest } from "../../db/schema";
import { createApp } from "../../lib/app";
import { requestConnection } from "../connections/repository";
import { emitToUsers } from "../messaging/gateway";
import { recordActivityInBackground } from "../streaks";
import { loadMemberSummaries } from "../users/memberSummary";
import * as repository from "./repository";
import { effectiveStatus } from "./service";

const repo = vi.mocked(repository);
const app = createApp();
const auth = { Authorization: "Bearer t" };

function quest(overrides: Partial<FlashQuest> = {}): FlashQuest {
  const now = Date.now();
  return {
    id: "q1",
    languageId: "es",
    hostId: "viewer-1",
    guestId: "partner-1",
    status: "ACTIVE",
    promptId: "ib01",
    challengeId: "fq01",
    hostWantsConnect: false,
    guestWantsConnect: false,
    createdAt: new Date(now - 10_000),
    startedAt: new Date(now - 5_000),
    endsAt: new Date(now - 5_000 + FLASH_QUEST_DURATION_MS),
    ...overrides,
  };
}

describe("flash quest status", () => {
  const now = new Date("2026-10-27T10:00:00Z");

  it("times out a search and ends a quest by the clock", () => {
    const searching = quest({ status: "SEARCHING", guestId: null, createdAt: new Date(now.getTime() - 1000) });
    expect(effectiveStatus(searching, now)).toBe("SEARCHING");
    const stale = { ...searching, createdAt: new Date(now.getTime() - FLASH_QUEST_SEARCH_TIMEOUT_MS - 1) };
    expect(effectiveStatus(stale, now)).toBe("CANCELLED");
    expect(effectiveStatus(quest({ endsAt: new Date(now.getTime() + 1) }), now)).toBe("ACTIVE");
    expect(effectiveStatus(quest({ endsAt: now }), now)).toBe("ENDED");
  });
});

describe("flash quest routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.languageName.mockResolvedValue("Spanish");
    repo.listMessages.mockResolvedValue([]);
    repo.countMessages.mockResolvedValue(0);
    vi.mocked(loadMemberSummaries).mockResolvedValue(new Map());
  });

  it("matches with a waiting partner and tells both members", async () => {
    repo.findOpenQuestFor.mockResolvedValue(null);
    repo.matchOrCreate.mockResolvedValue({
      quest: quest({ hostId: "partner-1", guestId: "viewer-1" }),
      matched: true,
    });

    const res = await request(app).post("/matchmaking/flash-quest").set(auth).send({ languageId: "es" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ACTIVE", languageName: "Spanish" });
    expect(res.body.topic.text.length).toBeGreaterThan(0);
    expect(repo.matchOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "viewer-1", languageId: "es", durationMs: FLASH_QUEST_DURATION_MS }),
    );
    expect(emitToUsers).toHaveBeenCalledTimes(2);
  });

  it("returns the search already running instead of opening a second one", async () => {
    repo.findOpenQuestFor.mockResolvedValue(
      quest({ status: "SEARCHING", guestId: null, startedAt: null, endsAt: null }),
    );
    const res = await request(app).post("/matchmaking/flash-quest").set(auth).send({ languageId: "es" });
    expect(res.body.status).toBe("SEARCHING");
    expect(repo.matchOrCreate).not.toHaveBeenCalled();
  });

  it("accepts chat while the timer runs and counts the streak", async () => {
    repo.findQuestFor.mockResolvedValue(quest());
    const res = await request(app)
      .post("/matchmaking/flash-quest/q1/messages")
      .set(auth)
      .send({ body: "  ¡Hola!  " });
    expect(res.status).toBe(200);
    expect(repo.insertMessage).toHaveBeenCalledWith("q1", "viewer-1", "¡Hola!");
    expect(recordActivityInBackground).toHaveBeenCalledWith("viewer-1");
  });

  it("refuses chat once the time is up", async () => {
    repo.findQuestFor.mockResolvedValue(quest({ endsAt: new Date(Date.now() - 60_000) }));
    const res = await request(app).post("/matchmaking/flash-quest/q1/messages").set(auth).send({ body: "late" });
    expect(res.status).toBe(409);
    expect(repo.insertMessage).not.toHaveBeenCalled();
  });

  it("connects both members only when the second one says yes", async () => {
    const ended = { endsAt: new Date(Date.now() - 1000) };
    repo.findQuestFor.mockResolvedValue(quest(ended));
    repo.setWantsConnect.mockResolvedValue(quest({ ...ended, hostWantsConnect: true }));
    const first = await request(app).post("/matchmaking/flash-quest/q1/connect").set(auth);
    expect(first.body).toMatchObject({ iWantToConnect: true, connected: false });
    expect(requestConnection).not.toHaveBeenCalled();

    repo.findQuestFor.mockResolvedValue(quest({ ...ended, guestWantsConnect: true }));
    repo.setWantsConnect.mockResolvedValue(quest({ ...ended, guestWantsConnect: true, hostWantsConnect: true }));
    const second = await request(app).post("/matchmaking/flash-quest/q1/connect").set(auth);
    expect(second.body).toMatchObject({ connected: true });
    expect(requestConnection).toHaveBeenCalledTimes(2);
    expect(recordActivityInBackground).toHaveBeenCalledWith("partner-1");
  });

  it("hides quests the viewer is not part of", async () => {
    repo.findQuestFor.mockResolvedValue(null);
    const res = await request(app).get("/matchmaking/flash-quest/q9").set(auth);
    expect(res.status).toBe(404);
  });
});
