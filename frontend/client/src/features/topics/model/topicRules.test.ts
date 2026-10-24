import { normalizeTopicTitle, topicTitleError } from "./topicRules";

describe("topic title rules", () => {
  it("normalises whitespace like the server", () => {
    expect(normalizeTopicTitle("  Street    food  ")).toBe("Street food");
  });

  it("checks length and duplicates (case-insensitive)", () => {
    expect(topicTitleError("ab", [])).toMatch(/at least/);
    expect(topicTitleError("x".repeat(81), [])).toMatch(/under/);
    expect(topicTitleError("travel STORIES", ["Travel stories"])).toMatch(/already/);
    expect(topicTitleError("Board games", ["Travel stories"])).toBeNull();
  });
});
