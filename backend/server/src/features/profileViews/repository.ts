import { and, count, desc, eq, gt } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { db } from "../../db/client";
import { profileViews, users } from "../../db/schema";
import { notBlockedBetween } from "../safety/blockFilter";

type Page = { limit: number; offset: number };

/** The other party (joined as `users`) is still an active member and not blocked either way. */
function liveCounterpart(userId: string, other: AnyPgColumn) {
  return and(eq(users.status, "ACTIVE"), notBlockedBetween(userId, other));
}

/** One row per viewer/profile pair: a repeat visit just moves `viewedAt` forward. */
export async function recordView(viewerId: string, viewedId: string) {
  const now = new Date();
  await db
    .insert(profileViews)
    .values({ viewerId, viewedId, viewedAt: now })
    .onConflictDoUpdate({
      target: [profileViews.viewerId, profileViews.viewedId],
      set: { viewedAt: now },
    });
}

export async function getVisitorsSeenAt(userId: string): Promise<Date | null> {
  const [row] = await db
    .select({ seenAt: users.visitorsSeenAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.seenAt ?? null;
}

export async function markVisitorsSeen(userId: string) {
  await db.update(users).set({ visitorsSeenAt: new Date() }).where(eq(users.id, userId));
}

export async function isPro(userId: string) {
  const [row] = await db
    .select({ isPro: users.isPro })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.isPro ?? false;
}

function visitorsOf(userId: string, since?: Date | null) {
  return and(
    eq(profileViews.viewedId, userId),
    liveCounterpart(userId, profileViews.viewerId),
    since ? gt(profileViews.viewedAt, since) : undefined,
  );
}

export async function countVisitors(userId: string, since?: Date | null) {
  const [row] = await db
    .select({ n: count() })
    .from(profileViews)
    .innerJoin(users, eq(users.id, profileViews.viewerId))
    .where(visitorsOf(userId, since));
  return row?.n ?? 0;
}

/** Visits since the owner last opened Visitors (the dashboard's "new visitors"). */
export async function countNewVisitors(userId: string) {
  return countVisitors(userId, await getVisitorsSeenAt(userId));
}

export function listVisitors(userId: string, page: Page) {
  return db
    .select({ userId: profileViews.viewerId, viewedAt: profileViews.viewedAt })
    .from(profileViews)
    .innerJoin(users, eq(users.id, profileViews.viewerId))
    .where(visitorsOf(userId))
    .orderBy(desc(profileViews.viewedAt))
    .limit(page.limit)
    .offset(page.offset);
}

function viewedBy(userId: string) {
  return and(eq(profileViews.viewerId, userId), liveCounterpart(userId, profileViews.viewedId));
}

export async function countViewed(userId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(profileViews)
    .innerJoin(users, eq(users.id, profileViews.viewedId))
    .where(viewedBy(userId));
  return row?.n ?? 0;
}

export function listViewed(userId: string, page: Page) {
  return db
    .select({ userId: profileViews.viewedId, viewedAt: profileViews.viewedAt })
    .from(profileViews)
    .innerJoin(users, eq(users.id, profileViews.viewedId))
    .where(viewedBy(userId))
    .orderBy(desc(profileViews.viewedAt))
    .limit(page.limit)
    .offset(page.offset);
}
