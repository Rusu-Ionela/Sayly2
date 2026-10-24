import type { ReferenceSummary } from "@/features/profile/types";
import { apiClient } from "@/lib/apiClient";

/** Mirrors backend features/references/types.ts. */
export type MyReference = { id: string; rating: number; body: string; createdAt: string };

type Reference = MyReference & {
  author: { id: string; displayName: string; avatarUrl: string | null };
};

export type ReferencesPage = {
  summary: ReferenceSummary;
  items: Reference[];
  page: number;
  hasMore: boolean;
  canWrite: boolean;
  mine: MyReference | null;
};

export type SaveReferenceInput = { rating: number; body: string };

export const MAX_REFERENCE_LENGTH = 500;

const referencesPath = (userId: string) => `/users/${encodeURIComponent(userId)}/references`;

export function getReferences(userId: string, page: number) {
  return apiClient.get<ReferencesPage>(`${referencesPath(userId)}?page=${page}`);
}

export function saveReference(userId: string, input: SaveReferenceInput) {
  return apiClient.post<MyReference>(referencesPath(userId), input);
}

export function deleteReference(userId: string) {
  return apiClient.delete<{ deleted: boolean }>(referencesPath(userId));
}
