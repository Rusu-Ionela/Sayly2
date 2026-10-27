import { testProfile } from "@/test/fixtures/profile";

import { buildProfileMenu, shareProfileMessage } from "./profileMenu";

const byKey = (profile = testProfile) =>
  Object.fromEntries(buildProfileMenu(profile).map((item) => [item.key, item]));

describe("profile menu", () => {
  it("lists every section in order, with Visitors and Viewed profiles marked Pro", () => {
    const items = buildProfileMenu(testProfile);
    expect(items.map((item) => item.key)).toEqual([
      "languages",
      "certificates",
      "collection",
      "learningPreferences",
      "topics",
      "connections",
      "leaderboard",
      "following",
      "visitors",
      "viewed",
    ]);
    expect(items.filter((item) => item.pro).map((item) => item.key)).toEqual([
      "visitors",
      "viewed",
    ]);
  });

  it("summarises languages and falls back to prompts when empty", () => {
    const menu = byKey();
    expect(menu.languages!.subtitle).toBe("Native: Romanian · Learning: English");
    expect(menu.certificates!.subtitle).toBe("Certify your language level");
    expect(menu.topics!.subtitle).toBe("Add what you love to talk about");
    expect(menu.learningPreferences!.subtitle).toBe(
      "Communication, time, schedule and corrections",
    );
    expect(menu.visitors!.badge).toBeUndefined();
  });

  it("shows live counts", () => {
    const menu = byKey({
      ...testProfile,
      mainTopic: "Street food",
      learningPreferences: {
        communication: ["VIDEO_CALLS"],
        timeCommitment: "DAILY",
        schedule: [],
        correction: "CORRECT_ME",
      },
      stats: { ...testProfile.stats, savedPhrases: 4, following: 1, newVisitors: 143 },
    });
    expect(menu.visitors!.subtitle).toBe("143 new visitors to your profile");
    expect(menu.visitors!.badge).toBe(143);
    expect(menu.following!.subtitle).toBe("1 person");
    expect(menu.collection!.subtitle).toBe("4 saved");
    expect(menu.topics!.subtitle).toBe("Main topic: Street food");
    expect(menu.learningPreferences!.subtitle).toBe("Video calls · Every day · Please correct me");
  });

  it("flags partner requests waiting for an answer", () => {
    const menu = Object.fromEntries(
      buildProfileMenu(testProfile, 2).map((item) => [item.key, item]),
    );
    expect(menu.connections!.subtitle).toBe("2 new requests waiting for you");
    expect(menu.connections!.badge).toBe(2);
    expect(byKey().connections!.badge).toBeUndefined();
  });

  it("builds a share message with the profile link", () => {
    expect(shareProfileMessage("K7QF3MZA")).toContain("https://sayly.app/u/K7QF3MZA");
  });
});
