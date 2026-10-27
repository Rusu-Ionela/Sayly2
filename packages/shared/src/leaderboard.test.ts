import { leaderboardWeekEnd, leaderboardWeekStart, rankByStreak } from "./leaderboard";

describe("rankByStreak", () => {
  it("sorts by streak and shares ranks on ties", () => {
    const ranked = rankByStreak([
      { displayName: "Cara", currentStreak: 3 },
      { displayName: "Ana", currentStreak: 9 },
      { displayName: "Bob", currentStreak: 9 },
      { displayName: "Dan", currentStreak: 0 },
    ]);
    expect(ranked.map((item) => [item.displayName, item.rank])).toEqual([
      ["Ana", 1],
      ["Bob", 1],
      ["Cara", 3],
      ["Dan", 4],
    ]);
  });
});

describe("leaderboard week", () => {
  it("runs Monday 00:00 UTC to the next Monday", () => {
    // Wednesday
    expect(leaderboardWeekStart(new Date("2026-10-28T15:00:00Z")).toISOString()).toBe(
      "2026-10-26T00:00:00.000Z",
    );
    // Sunday late evening still belongs to the same week
    expect(leaderboardWeekEnd(new Date("2026-11-01T23:59:00Z")).toISOString()).toBe(
      "2026-11-02T00:00:00.000Z",
    );
    // Monday midnight starts a new week
    expect(leaderboardWeekStart(new Date("2026-11-02T00:00:00Z")).toISOString()).toBe(
      "2026-11-02T00:00:00.000Z",
    );
  });
});
