import { describe, expect, it } from "vitest";

import {
  learningPreferencesSchema,
  toLearningPreferenceColumns,
  toLearningPreferencesDto,
} from "./learningPreferences";
import { updateProfileSchema } from "./schema";

describe("learning preferences", () => {
  it("defaults to empty when nothing is set", () => {
    expect(toLearningPreferencesDto(null)).toEqual({
      communication: [],
      timeCommitment: null,
      schedule: [],
      correction: null,
    });
  });

  it("maps stored columns and drops unknown values", () => {
    expect(
      toLearningPreferencesDto({
        communicationMethods: ["TEXT", "TELEPATHY", "VIDEO_CALLS"],
        timeCommitment: "WEEKLY",
        learningSchedule: ["EVENINGS"],
        correctionPreference: "SOMETIMES",
      }),
    ).toEqual({
      communication: ["TEXT", "VIDEO_CALLS"],
      timeCommitment: "WEEKLY",
      schedule: ["EVENINGS"],
      correction: null,
    });
  });

  it("validates choices, rejects duplicates and unknown keys", () => {
    expect(learningPreferencesSchema.parse({ correction: "CORRECT_ME" })).toEqual({ correction: "CORRECT_ME" });
    expect(learningPreferencesSchema.parse({ timeCommitment: null })).toEqual({ timeCommitment: null });
    for (const bad of [
      { communication: ["TEXT", "TEXT"] },
      { communication: ["FAX"] },
      { timeCommitment: "HOURLY" },
      { mood: "happy" },
    ]) {
      expect(() => learningPreferencesSchema.parse(bad)).toThrow();
    }
  });

  it("only writes the fields that were sent", () => {
    expect(toLearningPreferenceColumns({ schedule: ["WEEKENDS"], correction: null })).toEqual({
      learningSchedule: ["WEEKENDS"],
      correctionPreference: null,
    });
  });

  it("is accepted by PATCH /users/me on its own", () => {
    const parsed = updateProfileSchema.parse({ learningPreferences: { timeCommitment: "DAILY" } });
    expect(parsed.learningPreferences).toEqual({ timeCommitment: "DAILY" });
  });
});
