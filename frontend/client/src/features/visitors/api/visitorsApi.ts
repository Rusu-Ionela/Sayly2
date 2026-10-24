import { apiClient } from "@/lib/apiClient";
import type { MemberPage, MemberSummary } from "@/shared/types/member";

export type VisitsMode = "visitors" | "viewed";

export type ProfileVisit = {
  member: MemberSummary;
  viewedAt: string;
  /** Visitors only: arrived since you last opened the list. */
  isNew: boolean;
};

/** `locked`: not Pro — counts only, no items. */
export type ProfileVisitsPage = MemberPage<ProfileVisit> & {
  locked: boolean;
  newCount: number;
};

const PAGE_SIZE = 20;

export function listProfileVisits(mode: VisitsMode, offset: number) {
  return apiClient.get<ProfileVisitsPage>(
    `/profile-views/${mode}?limit=${PAGE_SIZE}&offset=${offset}`,
  );
}

export function markVisitorsSeen() {
  return apiClient.post<{ ok: true }>("/profile-views/visitors/seen");
}
