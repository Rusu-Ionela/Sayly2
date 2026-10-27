/** What members want to practise; chosen in onboarding and on the profile. */
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

/** Interests for the profile "About me" section. */
export const TOPICS = [
  "Travel",
  "Music",
  "Movies & TV",
  "Books",
  "Food & cooking",
  "Sports",
  "Technology",
  "Science",
  "Art & design",
  "Gaming",
  "Business",
  "Politics",
  "History",
  "Nature",
  "Fashion",
  "Photography",
] as const;
export type Topic = (typeof TOPICS)[number];

/** Gallery photos besides the avatar. */
export const MAX_PROFILE_PHOTOS = 6;
export const MAX_TOPICS = 8;
export const MAX_CERTIFICATES = 10;
export const MIN_CERTIFICATE_YEAR = 1950;
/** Largest avatar or gallery image, in bytes. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/** CEFR level stated on a language certificate (self-reported, not verified). */
export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 50;
export const FIRST_NAME_MIN = 2;
export const LAST_NAME_MIN = 1;
export const PERSON_NAME_MAX = 40;
export const BIO_MAX = 500;
export const CITY_MIN = 2;
export const CITY_MAX = 60;
export const CERTIFICATE_TITLE_MIN = 2;
export const CERTIFICATE_TITLE_MAX = 60;
/** Members must be adults. */
export const MIN_AGE = 18;
export const MAX_AGE = 120;
