import { guidelinesFor } from "@/features/support/model/guidelines";

import { PROFILE_SECTIONS, SETTINGS_SCREEN_SECTIONS } from "./settingsSections";

const SETTINGS_SECTIONS = [...PROFILE_SECTIONS, ...SETTINGS_SCREEN_SECTIONS];

const rowsOf = (id: string) => {
  const section = SETTINGS_SECTIONS.find((item) => item.id === id);
  if (!section || section.kind === "appearance") throw new Error(`No rows section ${id}`);
  return section.items.map((item) =>
    item.kind === "toggle" ? item.key : item.kind === "external" ? item.id : item.action,
  );
};

describe("profile and settings sections", () => {
  it("follow the agreed order", () => {
    expect(PROFILE_SECTIONS.map((section) => section.id)).toEqual([
      "feedback",
      "help",
      "community",
      "legal",
      "privacy",
    ]);
    expect(SETTINGS_SCREEN_SECTIONS.map((section) => section.id)).toEqual([
      "notifications",
      "appearance",
      "safety",
      "account",
    ]);
    expect(rowsOf("feedback")).toEqual(["rateUs", "reportBug", "requestFeature"]);
    expect(rowsOf("help")).toEqual(["communityGuidelines", "partyGuidelines", "faq", "contactUs"]);
    expect(rowsOf("community")).toEqual(["blog", "youtube", "tiktok", "instagram", "snapchat"]);
    expect(rowsOf("legal").slice(0, 3)).toEqual(["aboutUs", "termsOfService", "privacyPolicy"]);
    expect(rowsOf("privacy")).toEqual(["showSaylyId", "showOnlineStatus", "showLocation"]);
  });

  it("never repeats a row between the profile and the Settings screen", () => {
    const all = SETTINGS_SECTIONS.flatMap((section) =>
      section.kind === "appearance" ? [] : rowsOf(section.id),
    );
    expect(new Set(all).size).toBe(all.length);
    // Lives in the profile header, not down here.
    expect(all).not.toContain("discoverable");
  });
});

describe("guidelines", () => {
  it("opens the community guidelines by default and the party rules on request", () => {
    expect(guidelinesFor("parties").heading).toBe("Language Parties guidelines");
    expect(guidelinesFor("community").heading).toBe("Community guidelines");
    expect(guidelinesFor("nonsense").heading).toBe("Community guidelines");
    expect(guidelinesFor(undefined).rules.length).toBeGreaterThan(0);
  });
});
