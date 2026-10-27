import { apiClient } from "@/lib/apiClient";

import type { DiscoverPage, DiscoveryFilters } from "../types";

type RequestOpts = { signal?: AbortSignal };

export function discoverUsers(
  filters: DiscoveryFilters & { page?: number; limit?: number },
  opts: RequestOpts = {},
) {
  const params = new URLSearchParams();
  params.set("page", String(filters.page ?? 1));
  params.set("limit", String(filters.limit ?? 20));

  if (filters.spokenLanguage) {
    params.set("spokenLanguageId", filters.spokenLanguage);
  }
  if (filters.learningLanguage) {
    params.set("learningLanguageId", filters.learningLanguage);
  }
  if (filters.country) params.set("country", filters.country);
  if (filters.search) params.set("search", filters.search);
  if (filters.proficiency) params.set("proficiency", filters.proficiency);
  if (filters.practiceGoal) params.set("practiceGoal", filters.practiceGoal);
  if (filters.matchType) params.set("matchType", filters.matchType);

  return apiClient.get<DiscoverPage>(`/discover?${params.toString()}`, { signal: opts.signal });
}
