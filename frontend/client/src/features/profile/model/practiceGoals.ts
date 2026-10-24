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
