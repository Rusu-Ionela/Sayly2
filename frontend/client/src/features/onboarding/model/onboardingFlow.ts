import type { UserLanguageSelection } from "@/features/languages/types";

export const ONBOARDING_STEPS = [
  "profile",
  "gender",
  "hello",
  "nativePrompt",
  "nativePick",
  "fluentPrompt",
  "fluentPick",
  "learnPrompt",
  "learnPick",
  "questions",
  "country",
  "photo",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type Gender = "MALE" | "FEMALE";

export const ONBOARDING_QUESTIONS = [
  "What do you like talking about?",
  "Why are you learning a language?",
  "What kind of practice partner are you hoping to find?",
] as const;

export const ANSWER_MIN_LENGTH = 15;
export const ANSWER_MAX_LENGTH = 280;

export type OnboardingDraft = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender | null;
  skipFluent: boolean;
  spokenLanguages: UserLanguageSelection[];
  learningLanguages: UserLanguageSelection[];
  answers: [string, string, string];
  country: string;
};

const DOB_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isAtLeast18(dateOfBirth: string, today = new Date()): boolean {
  if (!DOB_PATTERN.test(dateOfBirth)) {
    return false;
  }
  const birth = new Date(`${dateOfBirth}T00:00:00.000Z`);
  if (Number.isNaN(birth.getTime())) {
    return false;
  }
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  return age >= 18 && age <= 120;
}

export function displayNameFromDraft(draft: OnboardingDraft): string {
  return `${draft.firstName.trim()} ${draft.lastName.trim()}`.trim();
}

export function stepBlockReason(step: OnboardingStep, draft: OnboardingDraft): string | null {
  switch (step) {
    case "profile":
      if (draft.firstName.trim().length < 2) return "Enter your first name";
      if (draft.lastName.trim().length < 1) return "Enter your last name";
      return isAtLeast18(draft.dateOfBirth) ? null : "Choose a birthday. You must be 18 or older.";
    case "gender":
      return draft.gender ? null : "Choose Male or Female";
    case "nativePick":
      return draft.spokenLanguages.some((item) => item.proficiency === "NATIVE")
        ? null
        : "Choose the language you grew up speaking";
    case "fluentPick":
      return draft.spokenLanguages.some((item) => item.proficiency !== "NATIVE")
        ? null
        : "Add a language, or go back and skip";
    case "learnPick":
      return draft.learningLanguages.length > 0 ? null : "Add a language you want to practice";
    case "questions":
      return draft.answers.every((answer) => answer.trim().length >= ANSWER_MIN_LENGTH)
        ? null
        : `Write at least ${ANSWER_MIN_LENGTH} characters for each answer`;
    case "country":
      return draft.country.trim().length >= 2 ? null : "Choose your country";
    case "hello":
    case "nativePrompt":
    case "fluentPrompt":
    case "learnPrompt":
    case "photo":
      return null;
  }
}

export function canLeaveStep(step: OnboardingStep, draft: OnboardingDraft): boolean {
  return stepBlockReason(step, draft) === null;
}

export function nextOnboardingStep(
  step: OnboardingStep,
  draft: OnboardingDraft,
): OnboardingStep | null {
  if (step === "fluentPrompt" && draft.skipFluent) {
    return "learnPrompt";
  }
  const index = ONBOARDING_STEPS.indexOf(step);
  return ONBOARDING_STEPS[index + 1] ?? null;
}

export function previousOnboardingStep(
  step: OnboardingStep,
  draft: OnboardingDraft,
): OnboardingStep | null {
  if (step === "learnPrompt" && draft.skipFluent) {
    return "fluentPrompt";
  }
  const index = ONBOARDING_STEPS.indexOf(step);
  return index > 0 ? (ONBOARDING_STEPS[index - 1] ?? null) : null;
}
