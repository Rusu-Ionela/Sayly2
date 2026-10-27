import type { StreakDto } from "@sayly/shared";

import {
  celebrationCopy,
  celebrationFor,
  localToday,
  shouldCelebrate,
  streakForToday,
  streakLabel,
} from "./model";

const fromServer: StreakDto = {
  current: 4,
  longest: 9,
  lastActiveDate: "2026-10-23",
  activeToday: true,
  today: "2026-10-23",
};

describe("streak on the device", () => {
  it("formats the device's local day", () => {
    expect(localToday(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("keeps the server's answer for the same day", () => {
    expect(streakForToday(fromServer, "2026-10-23")).toBe(fromServer);
  });

  it("asks for today's activity the next morning", () => {
    expect(streakForToday(fromServer, "2026-10-24")).toMatchObject({
      current: 4,
      activeToday: false,
    });
  });

  it("shows a broken streak after a missed day, even from a cached copy", () => {
    expect(streakForToday(fromServer, "2026-10-25")).toMatchObject({ current: 0, longest: 9 });
  });

  it("labels it for screen readers", () => {
    expect(streakLabel(fromServer)).toBe("4 days streak");
    expect(streakLabel({ ...fromServer, activeToday: false })).toMatch(/practise today/);
    expect(streakLabel({ ...fromServer, current: 0 })).toBe("Start your streak today");
  });
});

describe("streak celebration", () => {
  const yesterday: StreakDto = {
    current: 2,
    longest: 5,
    lastActiveDate: "2026-10-26",
    activeToday: true,
    today: "2026-10-26",
  };
  const countedToday: StreakDto = {
    current: 3,
    longest: 5,
    lastActiveDate: "2026-10-27",
    activeToday: true,
    today: "2026-10-27",
  };

  it("celebrates the first activity of the day", () => {
    expect(shouldCelebrate(yesterday, countedToday, "2026-10-26")).toBe(true);
    expect(shouldCelebrate(undefined, countedToday, null)).toBe(true);
  });

  it("celebrates only once per day on this device", () => {
    expect(shouldCelebrate(yesterday, countedToday, "2026-10-27")).toBe(false);
  });

  it("stays quiet when today already counted before", () => {
    expect(shouldCelebrate(countedToday, { ...countedToday }, null)).toBe(false);
  });

  it("stays quiet while today does not count yet", () => {
    const pending = {
      ...countedToday,
      current: 2,
      lastActiveDate: "2026-10-26",
      activeToday: false,
    };
    expect(shouldCelebrate(yesterday, pending, null)).toBe(false);
  });

  it("rolls the count up by one and spots a personal best", () => {
    expect(celebrationFor(countedToday)).toEqual({ from: 2, to: 3, longest: 5, isBest: false });
    expect(celebrationFor({ ...countedToday, current: 6, longest: 6 }).isBest).toBe(true);
    expect(celebrationFor({ ...countedToday, current: 1, longest: 1 })).toMatchObject({
      from: 0,
      isBest: false,
    });
  });

  it("words day one and records differently", () => {
    expect(celebrationCopy({ from: 0, to: 1, longest: 4, isBest: false }).title).toBe(
      "Streak started!",
    );
    expect(celebrationCopy({ from: 2, to: 3, longest: 5, isBest: false }).title).toBe(
      "3-day streak!",
    );
    expect(celebrationCopy({ from: 5, to: 6, longest: 6, isBest: true }).title).toBe(
      "New personal best!",
    );
  });
});
