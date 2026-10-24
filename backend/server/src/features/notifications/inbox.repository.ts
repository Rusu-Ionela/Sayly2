import { and, count, desc, eq, isNull, lt } from "drizzle-orm";

import { db } from "../../db/client";
import { notifications, profiles, users } from "../../db/schema";
import { resignMediaUrl } from "../media/storage";

import type { InboxItem, InboxPage, NewInboxItem } from "./types";
import { notBlockedBetween } from "../safety/blockFilter";

export const INBOX_PAGE_SIZE = 30;

const INBOX_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

/** Inbox items older than 90 days are not worth keeping. */
export async function pruneOldInbox(now = new Date()) {
  await db.delete(notifications).where(lt(notifications.createdAt, new Date(now.getTime() - INBOX_RETENTION_MS)));
}

/** Stores one event; a repeated `dedupeKey` (re-follow, edited reference) is ignored. */
export async function insertInboxItem(item: NewInboxItem) {
  await db.insert(notifications).values(item).onConflictDoNothing({ target: notifications.dedupeKey });
}

/** Only rows from active, non-blocked actors — the same visibility rule as follows/references. */
function visibleTo(userId: string) {
  return and(
    eq(notifications.userId, userId),
    eq(users.status, "ACTIVE"),
    notBlockedBetween(userId, users.id),
  );
}

export async function listInbox(userId: string, page: number): Promise<InboxPage> {
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      conversationId: notifications.conversationId,
      createdAt: notifications.createdAt,
      readAt: notifications.readAt,
      actorId: users.id,
      actorName: profiles.displayName,
      actorAvatar: profiles.profileImageUrl,
    })
    .from(notifications)
    .innerJoin(users, eq(users.id, notifications.actorId))
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(visibleTo(userId))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(INBOX_PAGE_SIZE + 1)
    .offset((page - 1) * INBOX_PAGE_SIZE);

  const items: InboxItem[] = rows.slice(0, INBOX_PAGE_SIZE).map((row) => ({
    id: row.id,
    type: row.type,
    conversationId: row.conversationId,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
    actor: { id: row.actorId, displayName: row.actorName, avatarUrl: resignMediaUrl(row.actorAvatar) },
  }));

  return { items, page, hasMore: rows.length > INBOX_PAGE_SIZE };
}

export async function countUnread(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(notifications)
    .innerJoin(users, eq(users.id, notifications.actorId))
    .where(and(visibleTo(userId), isNull(notifications.readAt)));
  return row?.total ?? 0;
}

/** Scoped by owner: marking someone else's notification is a silent no-op. */
export async function markRead(userId: string, id: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId), isNull(notifications.readAt)));
}

export async function markAllRead(userId: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
