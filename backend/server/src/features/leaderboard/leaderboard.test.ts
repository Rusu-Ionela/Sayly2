import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../../shared/middleware/authenticate", () => import("../../test/authMock"));

vi.mock("./repository", () => ({
  findProUntil: vi.fn(),
  grantWeeklyRewards: vi.fn(),
}));
vi.mock("../connections/repository", () => ({
  listAcceptedPartnerIds: vi.fn(),
}));
vi.mock("../streaks/repository", () => ({
  findStreak: vi.fn(),
  findStreaks: vi.fn(),
  countActiveDay: vi.fn(),
  updateTimeZone: vi.fn(),
}));
vi.mock("../users/memberSummary", () => ({
  loadMemberSummaries: vi.fn(),
  assertVisibleMember: vi.fn(),
}));

import { createApp } from "../../lib/app";
import { TEST_VIEWER_ID } from "../../test/authMock";
import { listAcceptedPartnerIds } from "../connections/repository";
import { findStreaks } from "../streaks/repository";
import { loadMemberSummaries, type MemberSummaryDto } from "../users/memberSummary";
import { hasProAccess } from "../users/pro";
import * as repository from "./repository";
import { getFriendsLeaderboard, runWeeklyRewards } from "./service";

const repo = vi.mocked(repository);
const app = createApp();

function member(id: string, displayName: string): MemberSummaryDto {
  return {
    id,
    displayName,
    avatarUrl: null,
    country: "",
    city: null,
    isPro: false,
    nativeLanguage: null,
    learningLanguage: null,
    onlineStatus: "UNKNOWN",
    lastSeen: null,
  };
}

const NOW = new Date("2026-10-28T12:00:00Z"); // Wednesday

beforeEach(() => {
  vi.clearAllMocks();
  repo.findProUntil.mockResolvedValue(null);
});

describe("getFriendsLeaderboard", () => {
  it("ranks you and your partners by live streak", async () => {
    vi.mocked(listAcceptedPartnerIds).mockResolvedValue(["f1", "f2", "gone"]);
    vi.mocked(loadMemberSummaries).mockResolvedValue(
      new Map([
        ["me", member("me", "Me")],
        ["f1", member("f1", "Ana")],
        ["f2", member("f2", "Bob")],
      ]),
    );
    vi.mocked(findStreaks).mockResolvedValue([
      { userId: "me", currentStreak: 4, longestStreak: 4, lastActiveDate: "2026-10-28", timezone: "UTC" },
      { userId: "f1", currentStreak: 9, longestStreak: 9, lastActiveDate: "2026-10-27", timezone: "UTC" },
      // Last active three days ago: the streak is already broken.
      { userId: "f2", currentStreak: 20, longestStreak: 20, lastActiveDate: "2026-10-25", timezone: "UTC" },
    ]);

    const board = await getFriendsLeaderboard("me", NOW);

    expect(board.entries.map((e) => [e.displayName, e.rank, e.currentStreak, e.isMe])).toEqual([
      ["Ana", 1, 9, false],
      ["Me", 2, 4, true],
      ["Bob", 3, 0, false],
    ]);
    expect(board.weekEndsAt).toBe("2026-11-02T00:00:00.000Z");
    expect(board.rewardDays).toBe(1);
    expect(board.rewardProUntil).toBeNull();
  });

  it("shows a reward only while it lasts", async () => {
    vi.mocked(listAcceptedPartnerIds).mockResolvedValue([]);
    vi.mocked(loadMemberSummaries).mockResolvedValue(new Map([["me", member("me", "Me")]]));
    vi.mocked(findStreaks).mockResolvedValue([]);
    repo.findProUntil.mockResolvedValue(new Date("2026-10-29T00:00:00Z"));

    const board = await getFriendsLeaderboard("me", NOW);
    expect(board.rewardProUntil).toBe("2026-10-29T00:00:00.000Z");
    expect(board.entries).toHaveLength(1);
    expect(board.entries[0]).toMatchObject({ rank: 1, currentStreak: 0, isMe: true });
  });
});

describe("runWeeklyRewards", () => {
  it("pays winners on Monday with one day of Pro", async () => {
    repo.grantWeeklyRewards.mockResolvedValue(["u1"]);
    const monday = new Date("2026-11-02T00:10:00Z");

    await expect(runWeeklyRewards(monday)).resolves.toEqual(["u1"]);
    expect(repo.grantWeeklyRewards).toHaveBeenCalledWith(
      monday,
      new Date("2026-11-02T00:00:00Z"),
      new Date("2026-11-03T00:10:00Z"),
    );
  });

  it("does nothing on other days", async () => {
    await expect(runWeeklyRewards(NOW)).resolves.toEqual([]);
    expect(repo.grantWeeklyRewards).not.toHaveBeenCalled();
  });
});

describe("hasProAccess", () => {
  it("counts paid Pro and unexpired rewards", () => {
    expect(hasProAccess({ isPro: true, proUntil: null }, NOW)).toBe(true);
    expect(hasProAccess({ isPro: false, proUntil: new Date("2026-10-29T00:00:00Z") }, NOW)).toBe(true);
    expect(hasProAccess({ isPro: false, proUntil: new Date("2026-10-28T00:00:00Z") }, NOW)).toBe(false);
    expect(hasProAccess({ isPro: false, proUntil: null }, NOW)).toBe(false);
  });
});

describe("GET /leaderboard/friends", () => {
  it("requires sign-in", async () => {
    expect((await request(app).get("/leaderboard/friends")).status).toBe(401);
  });

  it("returns the board", async () => {
    vi.mocked(listAcceptedPartnerIds).mockResolvedValue([]);
    vi.mocked(loadMemberSummaries).mockResolvedValue(
      new Map([[TEST_VIEWER_ID, member(TEST_VIEWER_ID, "Me")]]),
    );
    vi.mocked(findStreaks).mockResolvedValue([]);

    const res = await request(app).get("/leaderboard/friends").set("Authorization", "Bearer t");
    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(1);
  });
});
