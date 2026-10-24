import {
  canLeaveStep,
  isAtLeast18,
  nextOnboardingStep,
  previousOnboardingStep,
  stepBlockReason,
  type OnboardingDraft,
} from "./onboardingFlow";

const empty: OnboardingDraft = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: null,
  skipFluent: false,
  spokenLanguages: [],
  learningLanguages: [],
  answers: ["", "", ""],
  country: "",
};

const readyProfile: OnboardingDraft = {
  ...empty,
  firstName: "Aryan",
  lastName: "S",
  dateOfBirth: "2004-05-18",
  gender: "MALE",
};

describe("onboarding steps", () => {
  it("requires a real name and a birthday before leaving the profile step", () => {
    expect(stepBlockReason("profile", empty)).toMatch(/first name/);
    expect(canLeaveStep("profile", { ...empty, firstName: "Aryan", lastName: "S" })).toBe(false);
    expect(canLeaveStep("profile", readyProfile)).toBe(true);
  });

  it("requires gender, a native language, and a learning language", () => {
    expect(canLeaveStep("gender", readyProfile)).toBe(true);
    expect(canLeaveStep("gender", { ...readyProfile, gender: null })).toBe(false);
    expect(canLeaveStep("nativePick", readyProfile)).toBe(false);
    expect(
      canLeaveStep("nativePick", {
        ...readyProfile,
        spokenLanguages: [{ languageId: "en", proficiency: "NATIVE" }],
      }),
    ).toBe(true);
    expect(canLeaveStep("learnPick", readyProfile)).toBe(false);
    expect(
      canLeaveStep("learnPick", {
        ...readyProfile,
        learningLanguages: [{ languageId: "es", proficiency: "BEGINNER" }],
      }),
    ).toBe(true);
  });

  it("requires three answers of at least 15 characters and keeps photo optional", () => {
    expect(canLeaveStep("questions", readyProfile)).toBe(false);
    expect(
      canLeaveStep("questions", {
        ...readyProfile,
        answers: ["I like films and food.", "I want to travel.", "Someone patient and kind."],
      }),
    ).toBe(true);
    expect(canLeaveStep("photo", readyProfile)).toBe(true);
    expect(canLeaveStep("hello", readyProfile)).toBe(true);
  });

  it("skips the fluent picker when the person chooses skip", () => {
    expect(nextOnboardingStep("fluentPrompt", { ...readyProfile, skipFluent: true })).toBe(
      "learnPrompt",
    );
    expect(previousOnboardingStep("learnPrompt", { ...readyProfile, skipFluent: true })).toBe(
      "fluentPrompt",
    );
    expect(nextOnboardingStep("fluentPrompt", readyProfile)).toBe("fluentPick");
  });

  it("accepts a country code and a birthday of someone 18 or older", () => {
    expect(canLeaveStep("country", { ...readyProfile, country: "IN" })).toBe(true);
    expect(canLeaveStep("country", readyProfile)).toBe(false);
    const today = new Date("2026-10-18T00:00:00.000Z");
    expect(isAtLeast18("2015-01-01", today)).toBe(false);
    expect(isAtLeast18("2008-10-19", today)).toBe(false);
    expect(isAtLeast18("2008-10-18", today)).toBe(true);
    expect(isAtLeast18("2004-05-18", today)).toBe(true);
  });
});
