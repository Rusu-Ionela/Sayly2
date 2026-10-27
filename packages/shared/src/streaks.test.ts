import { addDays, nextStreak, streakAsOf } from "./streaks";

const fresh = { current: 0, longest: 0, lastActiveDate: null };

describe("addDays", () => {
  it("crosses month, year and leap-day boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("nextStreak", () => {
  it("starts at 1", () => {
    expect(nextStreak(fresh, "2026-10-24")).toEqual({
      current: 1,
      longest: 1,
      lastActiveDate: "2026-10-24",
    });
  });

  it("grows on consecutive days and keeps the longest", () => {
    const day2 = nextStreak({ current: 4, longest: 4, lastActiveDate: "2026-10-23" }, "2026-10-24");
    expect(day2).toEqual({
      current: 5,
      longest: 5,
      lastActiveDate: "2026-10-24",
    });
  });

  it("counts a day only once", () => {
    const state = { current: 3, longest: 7, lastActiveDate: "2026-10-24" };
    expect(nextStreak(state, "2026-10-24")).toEqual(state);
  });

  it("restarts after a missed day but remembers the record", () => {
    expect(
      nextStreak({ current: 9, longest: 9, lastActiveDate: "2026-10-20" }, "2026-10-24"),
    ).toEqual({
      current: 1,
      longest: 9,
      lastActiveDate: "2026-10-24",
    });
  });

  it("ignores a day before the last one (time zone moved west)", () => {
    const state = { current: 2, longest: 2, lastActiveDate: "2026-10-24" };
    expect(nextStreak(state, "2026-10-23")).toEqual(state);
  });
});

describe("streakAsOf", () => {
  const state = { current: 6, longest: 10, lastActiveDate: "2026-10-23" };

  it("is still alive the day after, but not active yet", () => {
    expect(streakAsOf(state, "2026-10-24")).toMatchObject({
      current: 6,
      activeToday: false,
    });
  });

  it("is active on the same day", () => {
    expect(streakAsOf(state, "2026-10-23")).toMatchObject({
      current: 6,
      activeToday: true,
    });
  });

  it("shows 0 once a whole day was missed, keeping the longest", () => {
    expect(streakAsOf(state, "2026-10-25")).toMatchObject({
      current: 0,
      longest: 10,
      activeToday: false,
    });
  });

  it("handles a member with no activity yet", () => {
    expect(streakAsOf(fresh, "2026-10-24")).toEqual({
      current: 0,
      longest: 0,
      lastActiveDate: null,
      activeToday: false,
      today: "2026-10-24",
    });
  });
});
