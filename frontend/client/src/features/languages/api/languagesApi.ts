import { apiClient } from "@/lib/apiClient";

import type { Language, SyncUserLanguagesPayload, UserLanguagesGrouped } from "../types";

export function getLanguages() {
  return apiClient.get<Language[]>("/languages");
}

export function getMyLanguages() {
  return apiClient.get<UserLanguagesGrouped>("/users/me/languages");
}

export function putMyLanguages(body: SyncUserLanguagesPayload) {
  return apiClient.put<UserLanguagesGrouped>("/users/me/languages", body);
}
