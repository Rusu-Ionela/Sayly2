/** Mirrors backend `users/profileLimits.ts` and `users/topics.ts`. */
export const MAX_PROFILE_PHOTOS = 6;
export const MAX_TOPICS = 8;
export const MAX_CERTIFICATES = 10;
export const MIN_CERTIFICATE_YEAR = 1950;

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

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
