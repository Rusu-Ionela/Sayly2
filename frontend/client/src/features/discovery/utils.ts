import { countryFlagEmoji, findCountryByName } from "@/shared/data/countries";

import type { DiscoveryFilters, DiscoveryUser } from "./types";

export const DISCOVERY_PROFICIENCY_OPTIONS = [
  { value: "BEGINNER", label: "Beginner" },
  { value: "ELEMENTARY", label: "Elementary" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "UPPER_INTERMEDIATE", label: "Upper intermediate" },
  { value: "ADVANCED", label: "Advanced" },
  { value: "FLUENT", label: "Fluent" },
  { value: "NATIVE", label: "Native" },
] as const;

export function countryFlag(country: string) {
  const trimmed = country.trim();
  if (!trimmed) {
    return "🌍";
  }
  const byName = findCountryByName(trimmed);
  if (byName) {
    return countryFlagEmoji(byName.code);
  }
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    return countryFlagEmoji(trimmed);
  }
  return "🌍";
}

export function partnerAvatarUrl(user: DiscoveryUser) {
  return user.profileImageUrl || user.photoUrl || undefined;
}

export function countActiveFilters(filters: DiscoveryFilters) {
  return [
    filters.spokenLanguage,
    filters.learningLanguage,
    filters.country,
    filters.proficiency,
  ].filter((value) => Boolean(value && String(value).trim())).length;
}
