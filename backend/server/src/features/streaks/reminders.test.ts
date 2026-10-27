import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../notifications/repository", () => ({
  pushTokensOfMany: vi.fn(),
  deletePushTokens: vi.fn(),
}));

vi.mock("../notifications/expoPush", () => ({
  sendExpoPush: vi.fn(),
}));

import { sendExpoPush } from "../notifications/expoPush";
import * as notificationsRepo from "../notifications/repository";
import { sendStreakReminders, streakReminderContent } from "../notifications/service";
import { updateSettingsSchema } from "../users/schema";

const repo = vi.mocked(notificationsRepo);
const send = vi.mocked(sendExpoPush);

describe("streak reminder push", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("names the streak at stake", () => {
    expect(streakReminderContent(1).title).toBe("🔥 Keep your 1-day streak");
    expect(streakReminderContent(12).title).toBe("🔥 Keep your 12-day streak");
  });

  it("sends one batch to every device on the reminders channel and forgets dead ones", async () => {
    repo.pushTokensOfMany.mockResolvedValue([
      { userId: "a", token: "ExponentPushToken[a1]" },
      { userId: "a", token: "ExponentPushToken[a2]" },
      { userId: "b", token: "ExponentPushToken[b1]" },
    ]);
    send.mockResolvedValue(["ExponentPushToken[a2]"]);

    const devices = await sendStreakReminders([
      { userId: "a", currentStreak: 3 },
      { userId: "b", currentStreak: 1 },
    ]);

    expect(devices).toBe(3);
    expect(repo.pushTokensOfMany).toHaveBeenCalledWith(["a", "b"]);
    const messages = send.mock.calls[0]?.[0] ?? [];
    expect(messages).toHaveLength(3);
    expect(messages[0]).toMatchObject({
      to: "ExponentPushToken[a1]",
      title: "🔥 Keep your 3-day streak",
      channelId: "reminders",
      data: { type: "streak_reminder" },
    });
    expect(messages[2]).toMatchObject({ to: "ExponentPushToken[b1]", title: "🔥 Keep your 1-day streak" });
    expect(repo.deletePushTokens).toHaveBeenCalledWith(["ExponentPushToken[a2]"]);
  });

  it("can be switched off in settings", () => {
    expect(updateSettingsSchema.parse({ notifyStreakReminders: false })).toEqual({
      notifyStreakReminders: false,
    });
  });
});
