import type { MyReferenceDto, ReferencesPageDto, SaveReferenceInput } from "@sayly/shared";

import { apiClient } from "@/lib/apiClient";

const referencesPath = (userId: string) => `/users/${encodeURIComponent(userId)}/references`;

export function getReferences(userId: string, page: number) {
  return apiClient.get<ReferencesPageDto>(`${referencesPath(userId)}?page=${page}`);
}

export function saveReference(userId: string, input: SaveReferenceInput) {
  return apiClient.post<MyReferenceDto>(referencesPath(userId), input);
}

export function deleteReference(userId: string) {
  return apiClient.delete<{ deleted: boolean }>(referencesPath(userId));
}
