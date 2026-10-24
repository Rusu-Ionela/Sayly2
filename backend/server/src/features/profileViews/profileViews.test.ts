import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./repository", () => ({
  isPro: vi.fn(),
  getVisitorsSeenAt: vi.fn(),
  countVisitors: vi.fn(),
  listVisitors: vi.fn(),
  markVisitorsSeen: vi.fn(),
  countViewed: vi.fn(),
  listViewed: vi.fn(),
  recordView: vi.fn(),
}));
vi.mock("../users/memberSummary", () => ({
  loadMemberSummaries: vi.fn(
    async (ids: string[]) =>
      new Map(ids.filter((id) => id !== "gone").map((id) => [id, { id, displayName: id }])),
  ),
}));

import * as repository from "./repository";
import { listViewed, listVisitors, markVisitorsSeen } from "./service";

const repo = vi.mocked(repository);
const page = { limit: 20, offset: 0 };
const seenAt = new Date("2026-10-01T00:00:00Z");

describe("Visitors and Viewed profiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.getVisitorsSeenAt.mockResolvedValue(seenAt);
    repo.countVisitors.mockImplementation(async (_userId, since) => (since ? 3 : 143));
    repo.countViewed.mockResolvedValue(12);
  });

  it("gives non-Pro members the counts but never the list", async () => {
    repo.isPro.mockResolvedValue(false);

    await expect(listVisitors("me", page)).resolves.toEqual({
      locked: true,
      total: 143,
      newCount: 3,
      items: [],
      nextOffset: null,
    });
    await expect(listViewed("me", page)).resolves.toMatchObject({ locked: true, total: 12, items: [] });
    expect(repo.listVisitors).not.toHaveBeenCalled();
    expect(repo.listViewed).not.toHaveBeenCalled();
  });

  it("lists visitors for Pro members, flags new ones and skips deleted members", async () => {
    repo.isPro.mockResolvedValue(true);
    repo.listVisitors.mockResolvedValue([
      { userId: "fresh", viewedAt: new Date("2026-10-20T00:00:00Z") },
      { userId: "gone", viewedAt: new Date("2026-10-10T00:00:00Z") },
      { userId: "old", viewedAt: new Date("2026-09-01T00:00:00Z") },
    ]);

    const result = await listVisitors("me", page);

    expect(result.locked).toBe(false);
    expect(result.items.map((item) => [item.member.id, item.isNew])).toEqual([
      ["fresh", true],
      ["old", false],
    ]);
    expect(result.nextOffset).toBe(3);
  });

  it("only resets the new-visitor counter for Pro members", async () => {
    repo.isPro.mockResolvedValue(false);
    await markVisitorsSeen("me");
    expect(repo.markVisitorsSeen).not.toHaveBeenCalled();

    repo.isPro.mockResolvedValue(true);
    await markVisitorsSeen("me");
    expect(repo.markVisitorsSeen).toHaveBeenCalledWith("me");
  });
});
