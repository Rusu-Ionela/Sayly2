import type { RadarPartnerDto } from "@sayly/shared";

import {
  clockOffsetMs,
  expiresInLabel,
  formatCountdown,
  lastActiveLabel,
  layoutRadar,
  questRemainingMs,
  RING_FRACTIONS,
} from "./model";

function partner(id: string, ring: RadarPartnerDto["ring"]): RadarPartnerDto {
  return {
    id,
    displayName: id,
    avatarUrl: null,
    country: "",
    availability: "RECENT",
    lastActiveAt: "2026-10-27T10:00:00.000Z",
    ring,
    matchScore: 50,
    matchType: "PARTIAL",
    matchReason: null,
    canTeach: null,
    wantsToLearn: null,
    conversationId: null,
  };
}

describe("radar layout", () => {
  it("puts each partner on their ring and keeps the spot between refreshes", () => {
    const partners = [partner("a", 0), partner("b", 1), partner("c", 1), partner("d", 2)];
    const first = layoutRadar(partners, 100);
    const again = layoutRadar(partners, 100);

    expect(again).toEqual(first);
    for (const dot of first) {
      const distance = Math.hypot(dot.x, dot.y);
      expect(distance).toBeCloseTo(100 * RING_FRACTIONS[dot.partner.ring], 5);
    }
  });

  it("spreads partners on the same ring apart", () => {
    const dots = layoutRadar([partner("a", 1), partner("b", 1)], 100);
    const [one, two] = dots;
    expect(one && two && Math.hypot(one.x - two.x, one.y - two.y)).toBeGreaterThan(60);
  });
});

describe("quest clock", () => {
  it("counts down by the server's clock", () => {
    const receivedAt = Date.parse("2026-10-27T10:00:00.000Z");
    const offset = clockOffsetMs({ serverNow: "2026-10-27T10:00:02.000Z" }, receivedAt);
    expect(offset).toBe(2000);
    const quest = { endsAt: "2026-10-27T10:03:02.000Z" };
    expect(questRemainingMs(quest, offset, receivedAt)).toBe(180_000);
    expect(questRemainingMs(quest, offset, receivedAt + 200_000)).toBe(0);
    expect(questRemainingMs({ endsAt: null }, 0)).toBe(0);
  });

  it("formats the countdown", () => {
    expect(formatCountdown(180_000)).toBe("3:00");
    expect(formatCountdown(9_100)).toBe("0:10");
    expect(formatCountdown(-5)).toBe("0:00");
  });
});

describe("labels", () => {
  const now = Date.parse("2026-10-27T10:00:00.000Z");

  it("says how recently a partner was active", () => {
    expect(lastActiveLabel({ ...partner("a", 0), availability: "ONLINE" }, now)).toBe("Online now");
    expect(
      lastActiveLabel({ ...partner("a", 0), lastActiveAt: "2026-10-27T09:53:00.000Z" }, now),
    ).toBe("Active 7 min ago");
  });

  it("says how long a spark has left", () => {
    expect(expiresInLabel("2026-10-28T09:30:00.000Z", now)).toBe("23h left");
    expect(expiresInLabel("2026-10-27T10:45:00.000Z", now)).toBe("45m left");
  });
});
