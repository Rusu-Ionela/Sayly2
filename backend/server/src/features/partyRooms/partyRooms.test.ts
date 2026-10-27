import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../../shared/middleware/authenticate", () => import("../../test/authMock"));

vi.mock("./repository", () => ({
  createRoom: vi.fn(),
  listLiveRooms: vi.fn(),
  findRoom: vi.fn(),
  loadRoomDto: vi.fn(),
  findParticipation: vi.fn(),
  isInPartyRoom: vi.fn(),
}));
vi.mock("../groups/repository", () => ({
  getGroupAccess: vi.fn(),
  listActiveGroupIdsOf: vi.fn(),
}));
vi.mock("../calls/service", () => ({ currentCallId: vi.fn() }));

import type { PartyRoom } from "../../db/schema";
import { createApp } from "../../lib/app";
import { TEST_VIEWER_ID } from "../../test/authMock";
import { currentCallId } from "../calls/service";
import { getGroupAccess, listActiveGroupIdsOf } from "../groups/repository";
import * as repository from "./repository";
import { prepareJoin } from "./service";

const repo = vi.mocked(repository);
const app = createApp();
const auth = { Authorization: "Bearer t" };

function room(overrides: Partial<PartyRoom> = {}): PartyRoom {
  return {
    id: "r1",
    title: "Spanish small talk",
    languageId: "es",
    groupId: null,
    hostId: "host-1",
    status: "LIVE",
    createdAt: new Date(),
    endedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listActiveGroupIdsOf).mockResolvedValue(["g1"]);
  vi.mocked(currentCallId).mockResolvedValue(null);
  repo.findParticipation.mockResolvedValue(null);
});

describe("POST /party-rooms", () => {
  it("creates an open room for a known language", async () => {
    repo.createRoom.mockResolvedValue(room({ id: "r9", hostId: TEST_VIEWER_ID }));
    const res = await request(app).post("/party-rooms").set(auth).send({ title: "  Spanish small talk ", languageId: "ES" });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: "r9" });
    expect(repo.createRoom).toHaveBeenCalledWith({
      hostId: TEST_VIEWER_ID,
      title: "Spanish small talk",
      languageId: "es",
      groupId: null,
    });
  });

  it("requires group membership for a group room", async () => {
    vi.mocked(getGroupAccess).mockResolvedValue({ group: {} as never, membership: null });
    const res = await request(app).post("/party-rooms").set(auth).send({ title: "Club night", languageId: "es", groupId: "g2" });
    expect(res.status).toBe(403);
    expect(repo.createRoom).not.toHaveBeenCalled();
  });

  it("validates the title", async () => {
    const res = await request(app).post("/party-rooms").set(auth).send({ title: "x", languageId: "es" });
    expect(res.status).toBe(400);
  });
});

describe("GET /party-rooms", () => {
  it("lists open rooms with the viewer's group rooms allowed", async () => {
    repo.listLiveRooms.mockResolvedValue([]);
    const res = await request(app).get("/party-rooms?languageId=es").set(auth);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [] });
    expect(repo.listLiveRooms).toHaveBeenCalledWith({ languageId: "es", groupId: undefined, visibleGroupIds: ["g1"] });
  });

  it("404s for an ended room", async () => {
    repo.findRoom.mockResolvedValue(room({ status: "ENDED" }));
    const res = await request(app).get("/party-rooms/r1").set(auth);
    expect(res.status).toBe(404);
  });
});

describe("prepareJoin", () => {
  it("refuses while the member is on a 1:1 call", async () => {
    repo.findRoom.mockResolvedValue(room());
    vi.mocked(currentCallId).mockResolvedValue("call-1");
    await expect(prepareJoin(TEST_VIEWER_ID, "r1")).rejects.toMatchObject({ code: "CALL_BUSY" });
  });

  it("reports the room the member is leaving", async () => {
    repo.findRoom.mockResolvedValue(room());
    repo.findParticipation.mockResolvedValue({ roomId: "r0" } as never);
    await expect(prepareJoin(TEST_VIEWER_ID, "r1")).resolves.toEqual({ previousRoomId: "r0" });
  });
});
