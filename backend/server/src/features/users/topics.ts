/** Canonical conversation topics for the profile "About me" section. */
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
