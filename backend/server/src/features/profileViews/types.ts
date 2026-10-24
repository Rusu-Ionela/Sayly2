import type { MemberSummaryDto } from "../users/memberSummary";

export type ProfileVisitDto = {
  member: MemberSummaryDto;
  viewedAt: string;
  /** Visitors only: the visit happened after you last opened the list. */
  isNew: boolean;
};

/**
 * Visitors and Viewed profiles are Pro features: everyone gets the counts, only Pro
 * members get the list (`locked: true` and no items otherwise).
 */
export type ProfileVisitsPageDto = {
  locked: boolean;
  total: number;
  /** Visitors since you last opened the list (always 0 for viewed profiles). */
  newCount: number;
  items: ProfileVisitDto[];
  /** Offset of the next page, or null on the last one. */
  nextOffset: number | null;
};
