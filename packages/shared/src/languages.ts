/** Whether a profile language is one the member speaks or is learning. */
export const USER_LANGUAGE_TYPES = ["SPEAKS", "LEARNING"] as const;
export type UserLanguageType = (typeof USER_LANGUAGE_TYPES)[number];

/** From weakest to strongest. */
export const PROFICIENCY_LEVELS = [
  "BEGINNER",
  "ELEMENTARY",
  "INTERMEDIATE",
  "UPPER_INTERMEDIATE",
  "ADVANCED",
  "FLUENT",
  "NATIVE",
] as const;
export type ProficiencyLevel = (typeof PROFICIENCY_LEVELS)[number];

export const MAX_SPOKEN_LANGUAGES = 10;
export const MAX_LEARNING_LANGUAGES = 5;
export const MAX_NATIVE_LANGUAGES = 1;
export const MIN_LANGUAGES_PER_ROLE = 1;
