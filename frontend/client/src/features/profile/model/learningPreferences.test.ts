import {
  describePreferences,
  isSelected,
  learningPreferencesSummary,
  togglePreference,
  type LearningPreferences,
} from "./learningPreferences";

const empty: LearningPreferences = {
  communication: [],
  timeCommitment: null,
  schedule: [],
  correction: null,
};

describe("learning preferences", () => {
  it("adds and removes multi-choice values", () => {
    const added = togglePreference(empty, "communication", "TEXT");
    expect(added).toEqual({ communication: ["TEXT"] });
    const withText = { ...empty, communication: ["TEXT" as const] };
    expect(togglePreference(withText, "communication", "TEXT")).toEqual({ communication: [] });
    expect(togglePreference(empty, "schedule", "WEEKENDS")).toEqual({ schedule: ["WEEKENDS"] });
  });

  it("selects a single choice, and clears it when tapped again", () => {
    expect(togglePreference(empty, "timeCommitment", "DAILY")).toEqual({ timeCommitment: "DAILY" });
    const daily = { ...empty, timeCommitment: "DAILY" as const };
    expect(togglePreference(daily, "timeCommitment", "DAILY")).toEqual({ timeCommitment: null });
    expect(togglePreference(daily, "timeCommitment", "WEEKLY")).toEqual({
      timeCommitment: "WEEKLY",
    });
    expect(isSelected(daily, "timeCommitment", "DAILY")).toBe(true);
    expect(isSelected(daily, "correction", "CORRECT_ME")).toBe(false);
  });

  it("describes what is set, in display order", () => {
    const prefs: LearningPreferences = {
      communication: ["VIDEO_CALLS", "TEXT"],
      timeCommitment: null,
      schedule: ["EVENINGS"],
      correction: "ONLY_WHEN_ASKED",
    };
    expect(describePreferences(prefs).map((group) => [group.title, group.labels])).toEqual([
      ["Communication", ["Text", "Video calls"]],
      ["Learning schedule", ["Evenings"]],
      ["Correction", ["Only when I ask"]],
    ]);
    expect(learningPreferencesSummary(prefs)).toBe(
      "Text, Video calls · Evenings · Only when I ask",
    );
    expect(learningPreferencesSummary(empty)).toBe("Communication, time, schedule and corrections");
  });
});
