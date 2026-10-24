import type { ProficiencyLevel } from "../../db/schema";

export type DiscoverLanguage = {
  languageId: string;
  code: string;
  name: string;
  proficiency: ProficiencyLevel;
};

/** DISC-005 match band. */
export type MatchType = "MUTUAL" | "PARTIAL" | "NONE";

/** Public discovery card — no email, auth, DOB, or account flags. */
export type DiscoverUser = {
  id: string;
  displayName: string;
  country: string;
  profileImageUrl: string | null;
  /** @deprecated Prefer profileImageUrl — kept for existing mobile clients. */
  photoUrl?: string;
  age: number | null;
  /** Public bio, trimmed to a card-sized snippet. */
  bio: string;
  practiceGoals: string[];
  /** Goals the viewer also has. */
  sharedGoals: string[];
  spokenLanguages: DiscoverLanguage[];
  learningLanguages: DiscoverLanguage[];
  conversationId: string | null;
  matchScore: number;
  matchType: MatchType;
  matchLabel: string;
  /** Human-readable, data-backed reasons this person was recommended. */
  matchReasons: string[];
};

export type DiscoverFilters = {
  page: number;
  limit: number;
  search?: string;
  spokenLanguageId?: string;
  learningLanguageId?: string;
  country?: string;
  proficiency?: ProficiencyLevel;
  practiceGoal?: string;
  /** "MUTUAL" keeps only complementary partners (each can teach the other). */
  matchType?: "MUTUAL";
};

export type DiscoverPageMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

export type DiscoverResult = {
  items: DiscoverUser[];
  meta: DiscoverPageMeta;
  /** Aliases of meta.* for existing mobile clients. */
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  total: number;
  hasMore: boolean;
};
