import { FORBIDDEN_PUBLIC_PROFILE_KEYS } from "../users/dto";

import type {
  DiscoverLanguage,
  DiscoverUser,
  MatchType,
} from "./types";

export { FORBIDDEN_PUBLIC_PROFILE_KEYS };

type DiscoverUserSource = {
  id: string;
  displayName: string;
  country: string;
  profileImageUrl: string | null;
  age: number | null;
  bio: string;
  practiceGoals: string[];
  sharedGoals: string[];
  spokenLanguages: DiscoverLanguage[];
  learningLanguages: DiscoverLanguage[];
  conversationId?: string | null;
  matchScore: number;
  matchType: MatchType;
  matchLabel: string;
  matchReasons: string[];
};

export const DISCOVER_BIO_SNIPPET_LENGTH = 160;

export function bioSnippet(bio: string) {
  const clean = bio.trim().replace(/\s+/g, " ");
  return clean.length > DISCOVER_BIO_SNIPPET_LENGTH
    ? `${clean.slice(0, DISCOVER_BIO_SNIPPET_LENGTH - 1).trimEnd()}…`
    : clean;
}

/** DISC-004 card payload — public bio snippet only; no email, auth, or DOB. */
export function toDiscoverUserDto(source: DiscoverUserSource): DiscoverUser {
  const avatar = source.profileImageUrl;

  return {
    id: source.id,
    displayName: source.displayName,
    country: source.country,
    profileImageUrl: avatar,
    photoUrl: avatar ?? undefined,
    age: source.age,
    bio: bioSnippet(source.bio),
    practiceGoals: source.practiceGoals,
    sharedGoals: source.sharedGoals,
    spokenLanguages: source.spokenLanguages,
    learningLanguages: source.learningLanguages,
    conversationId: source.conversationId ?? null,
    matchScore: source.matchScore,
    matchType: source.matchType,
    matchLabel: source.matchLabel,
    matchReasons: source.matchReasons,
  };
}
