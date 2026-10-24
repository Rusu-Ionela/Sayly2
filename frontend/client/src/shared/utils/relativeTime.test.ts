import { relativeTime } from "./relativeTime";

const now = new Date("2026-10-21T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

describe("relativeTime", () => {
  it("describes recent moments in words", () => {
    expect(relativeTime(ago(10_000), now)).toBe("just now");
    expect(relativeTime(ago(5 * 60_000), now)).toBe("5 min ago");
    expect(relativeTime(ago(3 * 3_600_000), now)).toBe("3 h ago");
    expect(relativeTime(ago(26 * 3_600_000), now)).toBe("yesterday");
    expect(relativeTime(ago(4 * 86_400_000), now)).toBe("4 days ago");
  });

  it("falls back to a date for older moments and ignores bad input", () => {
    expect(relativeTime(ago(30 * 86_400_000), now)).not.toMatch(/ago/);
    expect(relativeTime("not a date", now)).toBe("");
  });
});
