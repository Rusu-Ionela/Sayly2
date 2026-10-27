import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../../shared/middleware/authenticate", () => import("../../test/authMock"));

vi.mock("./repository", () => ({
  findStreak: vi.fn(),
  countActiveDay: vi.fn(),
  updateTimeZone: vi.fn(),
}));

vi.mock("../messaging/gateway", () => ({
  emitToUsers: vi.fn(),
}));

import { createApp } from "../../lib/app";
import { emitToUsers } from "../messaging/gateway";
import * as repository from "./repository";
import { recordActivity } from "./service";
import { isValidTimeZone, localDateIn } from "./timezone";

const repo = vi.mocked(repository);
const emit = vi.mocked(emitToUsers);
const app = createApp();

describe("time zones", () => {
  it("gives the local calendar day", () => {
    const at = new Date("2026-10-24T22:30:00Z");
    expect(localDateIn("UTC", at)).toBe("2026-10-24");
    expect(localDateIn("Europe/Bucharest", at)).toBe("2026-10-25");
    expect(localDateIn("America/Los_Angeles", at)).toBe("2026-10-24");
  });

  it("falls back to UTC for unknown zones", () => {
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(localDateIn("Mars/Olympus", new Date("2026-10-24T23:30:00Z"))).toBe("2026-10-24");
  });
});

describe("recordActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not write again once today counts", async () => {
    const today = localDateIn("UTC");
    repo.findStreak.mockResolvedValue({
      currentStreak: 3,
      longestStreak: 5,
      lastActiveDate: today,
      timezone: "UTC",
    });

    const result = await recordActivity("u1");

    expect(result).toMatchObject({ current: 3, longest: 5, activeToday: true });
    expect(repo.countActiveDay).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it("counts the first activity of the day and tells the member's devices", async () => {
    repo.findStreak.mockResolvedValue(null);
    const today = localDateIn("Europe/Bucharest");
    repo.countActiveDay.mockResolvedValue({
      currentStreak: 1,
      longestStreak: 1,
      lastActiveDate: today,
      timezone: "Europe/Bucharest",
    });

    const result = await recordActivity("u1", "Europe/Bucharest");

    expect(repo.countActiveDay).toHaveBeenCalledWith("u1", today, "Europe/Bucharest");
    expect(result).toMatchObject({ current: 1, activeToday: true, today });
    expect(emit).toHaveBeenCalledWith(["u1"], "streak_updated", result);
  });

  it("keeps the time zone current even when today already counts", async () => {
    repo.findStreak.mockResolvedValue({
      currentStreak: 1,
      longestStreak: 1,
      lastActiveDate: "2999-01-01",
      timezone: "UTC",
    });

    await recordActivity("u1", "Asia/Tokyo");

    expect(repo.updateTimeZone).toHaveBeenCalledWith("u1", "Asia/Tokyo");
    expect(repo.countActiveDay).not.toHaveBeenCalled();
  });
});

describe("streak routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires sign-in", async () => {
    expect((await request(app).get("/streaks/me")).status).toBe(401);
  });

  it("returns 0 for a member who has not started", async () => {
    repo.findStreak.mockResolvedValue(null);
    const res = await request(app).get("/streaks/me").set("Authorization", "Bearer t");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ current: 0, longest: 0, activeToday: false });
  });

  it("rejects an unknown time zone on check-in", async () => {
    const res = await request(app)
      .post("/streaks/me/check-in")
      .set("Authorization", "Bearer t")
      .send({ timezone: "Not/AZone" });
    expect(res.status).toBe(400);
    expect(repo.countActiveDay).not.toHaveBeenCalled();
  });

  it("checks in with the device time zone", async () => {
    repo.findStreak.mockResolvedValue(null);
    repo.countActiveDay.mockResolvedValue({
      currentStreak: 1,
      longestStreak: 1,
      lastActiveDate: localDateIn("Europe/Bucharest"),
      timezone: "Europe/Bucharest",
    });
    const res = await request(app)
      .post("/streaks/me/check-in")
      .set("Authorization", "Bearer t")
      .send({ timezone: "Europe/Bucharest" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ current: 1, activeToday: true });
  });
});
