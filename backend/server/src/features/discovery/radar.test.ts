import { describe, expect, it } from "vitest";
import type { RadarPartnerDto } from "@sayly/shared";

import { compareRadarPartners } from "./radar";

function partner(overrides: Partial<RadarPartnerDto>): RadarPartnerDto {
  return {
    id: "p",
    displayName: "P",
    avatarUrl: null,
    country: "",
    availability: "RECENT",
    lastActiveAt: "2026-10-27T10:00:00.000Z",
    ring: 1,
    matchScore: 60,
    matchType: "PARTIAL",
    matchReason: null,
    canTeach: null,
    wantsToLearn: null,
    conversationId: null,
    ...overrides,
  };
}

describe("radar order", () => {
  it("puts the closest language fit first, then who is online, then score and recency", () => {
    const items = [
      partner({ id: "recent-partial", ring: 1 }),
      partner({ id: "online-partial", ring: 1, availability: "ONLINE" }),
      partner({ id: "recent-mutual", ring: 0, matchScore: 101 }),
      partner({ id: "older-partial", ring: 1, lastActiveAt: "2026-10-27T09:50:00.000Z" }),
      partner({ id: "outer", ring: 2, availability: "ONLINE" }),
    ];
    expect(items.sort(compareRadarPartners).map((item) => item.id)).toEqual([
      "recent-mutual",
      "online-partial",
      "recent-partial",
      "older-partial",
      "outer",
    ]);
  });
});
