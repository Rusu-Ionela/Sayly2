/** Canonical practice goals for onboarding + profile edit (PRO-002). */
export const PRACTICE_GOALS = [
  "Conversation",
  "Speaking",
  "Listening",
  "Reading",
  "Writing",
  "Grammar",
  "Vocabulary",
  "Pronunciation",
  "Culture",
] as const;

export type PracticeGoal = (typeof PRACTICE_GOALS)[number];

export const PRACTICE_GOAL_SET = new Set<string>(PRACTICE_GOALS);
