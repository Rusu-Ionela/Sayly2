import { logger } from "../../shared/utils/logger";
import type { PageQuery } from "../../shared/validation/pageQuery";
import { loadMemberSummaries } from "../users/memberSummary";

import * as viewsRepository from "./repository";
import type { ProfileVisitsPageDto } from "./types";

type VisitRow = { userId: string; viewedAt: Date };

async function toPage(
  rows: VisitRow[],
  page: PageQuery,
  counts: { total: number; newCount: number },
  isNew: (viewedAt: Date) => boolean,
): Promise<ProfileVisitsPageDto> {
  const members = await loadMemberSummaries(rows.map((row) => row.userId));
  const items = rows.flatMap((row) => {
    const member = members.get(row.userId);
    return member
      ? [{ member, viewedAt: row.viewedAt.toISOString(), isNew: isNew(row.viewedAt) }]
      : [];
  });
  const consumed = page.offset + rows.length;
  return {
    locked: false,
    ...counts,
    items,
    nextOffset: consumed < counts.total ? consumed : null,
  };
}

function lockedPage(total: number, newCount: number): ProfileVisitsPageDto {
  return { locked: true, total, newCount, items: [], nextOffset: null };
}

/** GET /profile-views/visitors — who looked at your profile. */
export async function listVisitors(userId: string, page: PageQuery): Promise<ProfileVisitsPageDto> {
  const [pro, seenAt] = await Promise.all([
    viewsRepository.isPro(userId),
    viewsRepository.getVisitorsSeenAt(userId),
  ]);
  const [total, newCount] = await Promise.all([
    viewsRepository.countVisitors(userId),
    viewsRepository.countVisitors(userId, seenAt),
  ]);
  if (!pro) {
    return lockedPage(total, newCount);
  }
  const rows = await viewsRepository.listVisitors(userId, page);
  return toPage(rows, page, { total, newCount }, (viewedAt) => !seenAt || viewedAt > seenAt);
}

/** POST /profile-views/visitors/seen — resets the "new visitors" counter (Pro only). */
export async function markVisitorsSeen(userId: string) {
  if (await viewsRepository.isPro(userId)) {
    await viewsRepository.markVisitorsSeen(userId);
  }
  return { ok: true as const };
}

/** GET /profile-views/viewed — profiles you looked at. */
export async function listViewed(userId: string, page: PageQuery): Promise<ProfileVisitsPageDto> {
  const [pro, total] = await Promise.all([
    viewsRepository.isPro(userId),
    viewsRepository.countViewed(userId),
  ]);
  if (!pro) {
    return lockedPage(total, 0);
  }
  const rows = await viewsRepository.listViewed(userId, page);
  return toPage(rows, page, { total, newCount: 0 }, () => false);
}

/**
 * Called when someone opens a public profile. Never fails the page: a lost visit
 * only means one fewer entry in a Visitors list.
 */
export function recordProfileView(viewerId: string, viewedId: string) {
  void viewsRepository.recordView(viewerId, viewedId).catch((error: unknown) => {
    logger.warn("profile-views", "could not record profile view", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  });
}
