import { describe, expect, it } from "vitest";

import { withinReuseGrace } from "./repository";

describe("refresh token reuse grace", () => {
  const rotatedAt = new Date("2026-01-01T00:00:00Z");

  it("accepts a token rotated a few seconds ago", () => {
    expect(withinReuseGrace(rotatedAt, null, rotatedAt.getTime() + 5_000)).toBe(true);
  });

  it("treats an old reuse as theft", () => {
    expect(withinReuseGrace(rotatedAt, null, rotatedAt.getTime() + 60_000)).toBe(false);
  });

  it("refuses once the family was revoked, even inside the window", () => {
    expect(withinReuseGrace(rotatedAt, new Date(), rotatedAt.getTime() + 5_000)).toBe(false);
  });
});
