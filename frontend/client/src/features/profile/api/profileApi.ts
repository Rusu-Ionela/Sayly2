import { apiClient } from "@/lib/apiClient";

import type {
  CompleteOnboardingPayload,
  CurrentUserProfile,
  PublicUserProfile,
  UpdateProfilePayload,
  UpdateSettingsPayload,
} from "../types";

export function getMe() {
  return apiClient.get<CurrentUserProfile>("/users/me");
}

/** PRO-002 — atomic profile + avatar + languages + practice goals */
export function updateProfile(body: UpdateProfilePayload) {
  return apiClient.put<CurrentUserProfile>("/users/me/profile", body);
}

/** Privacy + notification toggles; returns the full profile like updateProfile. */
export function updateSettings(body: UpdateSettingsPayload) {
  return apiClient.patch<CurrentUserProfile>("/users/me/settings", body);
}

/** PRO-001 / PRO-003 — privacy-safe public profile (no email / auth fields) */
export function getPublicProfile(userId: string) {
  return apiClient.get<PublicUserProfile>(`/users/${userId}/public-profile`);
}

export type TranslatableProfileField = "bio" | "topics";

export function translateProfileField(userId: string, field: TranslatableProfileField) {
  return apiClient.post<{ text: string; lang: string }>(`/users/${userId}/translate`, { field });
}

export function completeOnboarding(body: CompleteOnboardingPayload) {
  return apiClient.put<CurrentUserProfile>("/users/me/onboarding", body);
}

/** "Download my data" — everything Sayly keeps about you, as JSON. */
export function exportMyData() {
  return apiClient.get<Record<string, unknown>>("/users/me/export");
}

/** Resolves a shared Sayly ID to a member id (404 when unknown or turned off). */
export function findBySaylyId(saylyId: string) {
  return apiClient.get<{ userId: string }>(`/users/by-sayly-id/${encodeURIComponent(saylyId)}`);
}
