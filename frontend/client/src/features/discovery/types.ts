import type { ProficiencyLevel } from "@/features/languages/types";

export type DiscoverLanguage = {
  languageId: string;
  code: string;
  name: string;
  proficiency: string;
  flagEmoji?: string;
};

export type DiscoveryUser = {
  id: string;
  displayName: string;
  country: string;
  bio?: string;
  practiceGoals?: string[];
  sharedGoals?: string[];
  /** Server-computed, data-backed reasons for the recommendation. */
  matchReasons?: string[];
  profileImageUrl?: string | null;
  photoUrl?: string;
  age: number | null;
  spokenLanguages: DiscoverLanguage[];
  learningLanguages: DiscoverLanguage[];
  conversationId?: string | null;
  matchScore: number;
  matchType: "MUTUAL" | "PARTIAL" | "NONE";
  matchLabel: string;
};

/** DISC-003 proficiency filter (matches backend CEFR-style levels). */
export type DiscoveryProficiencyFilter =
  | "BEGINNER"
  | "ELEMENTARY"
  | "INTERMEDIATE"
  | "UPPER_INTERMEDIATE"
  | "ADVANCED"
  | "FLUENT"
  | "NATIVE";

export type DiscoveryFilters = {
  spokenLanguage?: string;
  learningLanguage?: string;
  country?: string;
  search?: string;
  proficiency?: DiscoveryProficiencyFilter | ProficiencyLevel;
  practiceGoal?: string;
  matchType?: "MUTUAL";
};

export type DiscoverPage = {
  items: DiscoveryUser[];
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  page: number;
  limit: number;
  total: number;
  totalCount?: number;
  totalPages?: number;
  hasMore: boolean;
};
