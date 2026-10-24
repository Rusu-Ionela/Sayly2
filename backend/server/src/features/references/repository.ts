import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "../../db/client";
import { messages, profiles, references, users } from "../../db/schema";
import { resignMediaUrl } from "../media/storage";
import { findDirectConversationId } from "../messaging/repository";
import { notBlockedBetween } from "../safety/blockFilter";

import {
  POSITIVE_RATING,
  REFERENCES_PAGE_SIZE,
  type MyReferenceDto,
  type ReferenceDto,
  type ReferenceSummaryDto,
  type SaveReferenceInput,
} from "./types";

const OWN_COLUMNS = {
  id: references.id,
  rating: references.rating,
  body: references.body,
  createdAt: references.createdAt,
};

function toMyReferenceDto(row: { id: string; rating: number; body: string; createdAt: Date }): MyReferenceDto {
  return { id: row.id, rating: row.rating, body: row.body, createdAt: row.createdAt.toISOString() };
}

/** References about `subjectId` from active authors; with a viewer, also hides blocked authors. */
function liveReferencesAbout(subjectId: string, viewerId?: string) {
  return and(
    eq(references.subjectId, subjectId),
    eq(users.status, "ACTIVE"),
    viewerId ? notBlockedBetween(viewerId, users.id) : undefined,
  );
}

/**
 * Count shown on every profile. With a viewer, authors they blocked (or who blocked them)
 * are left out, so the count matches the list they can see.
 */
export async function summarizeReferences(
  subjectId: string,
  viewerId?: string,
): Promise<ReferenceSummaryDto> {
  const [row] = await db
    .select({
      total: count(),
      positive: sql<number>`count(*) filter (where ${gte(references.rating, POSITIVE_RATING)})`.mapWith(Number),
    })
    .from(references)
    .innerJoin(users, eq(users.id, references.authorId))
    .where(liveReferencesAbout(subjectId, viewerId));
  return { total: row?.total ?? 0, positive: row?.positive ?? 0 };
}

/** One page, newest first. Fetches one extra row to know whether there is a next page. */
export async function listReferencesPage(
  viewerId: string,
  subjectId: string,
  page: number,
): Promise<{ items: ReferenceDto[]; hasMore: boolean }> {
  const rows = await db
    .select({
      ...OWN_COLUMNS,
      authorId: users.id,
      displayName: profiles.displayName,
      avatar: profiles.profileImageUrl,
    })
    .from(references)
    .innerJoin(users, eq(users.id, references.authorId))
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(liveReferencesAbout(subjectId, viewerId))
    .orderBy(desc(references.createdAt), desc(references.id))
    .limit(REFERENCES_PAGE_SIZE + 1)
    .offset((page - 1) * REFERENCES_PAGE_SIZE);

  return {
    items: rows.slice(0, REFERENCES_PAGE_SIZE).map((row) => ({
      ...toMyReferenceDto(row),
      author: {
        id: row.authorId,
        displayName: row.displayName,
        avatarUrl: resignMediaUrl(row.avatar),
      },
    })),
    hasMore: rows.length > REFERENCES_PAGE_SIZE,
  };
}

export async function findMine(authorId: string, subjectId: string): Promise<MyReferenceDto | null> {
  const [row] = await db
    .select(OWN_COLUMNS)
    .from(references)
    .where(and(eq(references.authorId, authorId), eq(references.subjectId, subjectId)))
    .limit(1);
  return row ? toMyReferenceDto(row) : null;
}

/** Both people have sent at least one message in their direct chat. Stops drive-by reviews. */
export async function haveExchangedMessages(userA: string, userB: string) {
  const conversationId = await findDirectConversationId(userA, userB);
  if (!conversationId) {
    return false;
  }
  const [row] = await db
    .select({ senders: sql<number>`count(distinct ${messages.senderId})` })
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), inArray(messages.senderId, [userA, userB])));
  return Number(row?.senders ?? 0) === 2;
}

/** Creates the author's reference, or replaces the previous one (one per pair). */
export async function upsertReference(
  authorId: string,
  subjectId: string,
  input: SaveReferenceInput,
): Promise<MyReferenceDto> {
  const [row] = await db
    .insert(references)
    .values({ authorId, subjectId, rating: input.rating, body: input.body })
    .onConflictDoUpdate({
      target: [references.authorId, references.subjectId],
      set: { rating: input.rating, body: input.body, updatedAt: new Date() },
    })
    .returning(OWN_COLUMNS);
  if (!row) {
    throw new Error("Database did not return reference");
  }
  return toMyReferenceDto(row);
}

/** Idempotent. */
export async function deleteReference(authorId: string, subjectId: string) {
  await db
    .delete(references)
    .where(and(eq(references.authorId, authorId), eq(references.subjectId, subjectId)));
}

/** "Download my data": references you wrote (what others wrote about you stays theirs). */
export function listWrittenBy(authorId: string) {
  return db
    .select({
      subjectId: references.subjectId,
      rating: references.rating,
      body: references.body,
      createdAt: references.createdAt,
    })
    .from(references)
    .where(eq(references.authorId, authorId))
    .orderBy(desc(references.createdAt));
}
