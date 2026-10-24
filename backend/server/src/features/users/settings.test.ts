import { beforeEach, describe, expect, it, vi } from "vitest";

const broadcastPresence = vi.fn(async () => undefined);
const updateSettingsRow = vi.fn(async () => undefined);
const getCurrentUserSource = vi.fn();

vi.mock("../messaging/presenceBroadcast", () => ({ broadcastPresence }));
vi.mock("./settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./settings")>()),
  updateSettings: updateSettingsRow,
}));
vi.mock("./repository", () => ({ getCurrentUserSource }));

const { updateSettings } = await import("./service");

describe("PATCH /users/me/settings side effects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserSource.mockResolvedValue({
      id: "u1",
      email: "u1@example.test",
      saylyId: "K7QF3MZA",
      isPro: false,
      onboardingCompleted: true,
      profile: null,
      languages: [],
      certificates: [],
      conversationTopics: [],
      referenceSummary: { total: 0, positive: 0 },
      settings: null,
      stats: { partners: 0, savedPhrases: 0, groups: 0, following: 0, newVisitors: 0 },
    });
  });

  it("pushes fresh presence to partners when online status visibility changes", async () => {
    await updateSettings("u1", { showOnlineStatus: false });
    expect(updateSettingsRow).toHaveBeenCalledWith("u1", { showOnlineStatus: false });
    expect(broadcastPresence).toHaveBeenCalledWith("u1");
  });

  it("does not broadcast for unrelated toggles", async () => {
    await updateSettings("u1", { notifyMessages: false });
    expect(broadcastPresence).not.toHaveBeenCalled();
  });
});
