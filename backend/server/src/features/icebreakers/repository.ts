import { and, count, desc, eq, lt, ne, or, type SQL } from "drizzle-orm";

import { ICEBREAKER_ANSWERS_PAGE_SIZE } from "@sayly/shared";

import { db } from "../../db/client";
import { icebreakerAnswers, users } from "../../db/schema";
import { notBlockedBetween } from "../safety/blockFilter";

type Day = { languageId: string; promptDate: string };

/** Answers by other members the viewer may see: active, onboarded, no block either way. */
function visibleToViewer(viewerId: string, day: Day): SQL | undefined {
  return and(
    eq(icebreakerAnswers.languageId, day.languageId),
    eq(icebreakerAnswers.promptDate, day.promptDate),
    ne(icebreakerAnswers.userId, viewerId),
    eq(users.status, "ACTIVE"),
    eq(users.onboardingCompleted, true),
    notBlockedBetween(viewerId, icebreakerAnswers.userId),
  );
}

export async function findOwnAnswer(userId: string, day: Day) {
  const [row] = await db
    .select({ body: icebreakerAnswers.body, updatedAt: icebreakerAnswers.updatedAt })
    .from(icebreakerAnswers)
    .where(
      and(
        eq(icebreakerAnswers.userId, userId),
        eq(icebreakerAnswers.languageId, day.languageId),
        eq(icebreakerAnswers.promptDate, day.promptDate),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function countVisibleAnswers(viewerId: string, day: Day): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(icebreakerAnswers)
    .innerJoin(users, eq(users.id, icebreakerAnswers.userId))
    .where(visibleToViewer(viewerId, day));
  return row?.total ?? 0;
}

/** Newest first; `cursor` is the id of the last answer of the previous page. */
export async function listVisibleAnswers(viewerId: string, day: Day, cursor?: string) {
  let after: SQL | undefined;
  if (cursor) {
    const [anchor] = await db
      .select({ createdAt: icebreakerAnswers.createdAt, id: icebreakerAnswers.id })
      .from(icebreakerAnswers)
      .where(eq(icebreakerAnswers.id, cursor))
      .limit(1);
    if (anchor) {
      after = or(
        lt(icebreakerAnswers.createdAt, anchor.createdAt),
        and(eq(icebreakerAnswers.createdAt, anchor.createdAt), lt(icebreakerAnswers.id, anchor.id)),
      );
    }
  }

  const rows = await db
    .select({
      id: icebreakerAnswers.id,
      userId: icebreakerAnswers.userId,
      body: icebreakerAnswers.body,
      createdAt: icebreakerAnswers.createdAt,
    })
    .from(icebreakerAnswers)
    .innerJoin(users, eq(users.id, icebreakerAnswers.userId))
    .where(and(visibleToViewer(viewerId, day), after))
    .orderBy(desc(icebreakerAnswers.createdAt), desc(icebreakerAnswers.id))
    .limit(ICEBREAKER_ANSWERS_PAGE_SIZE + 1);

  const hasMore = rows.length > ICEBREAKER_ANSWERS_PAGE_SIZE;
  return { rows: rows.slice(0, ICEBREAKER_ANSWERS_PAGE_SIZE), hasMore };
}

/** One answer per member, language and day: answering again edits it. */
export async function saveAnswer(userId: string, day: Day & { promptId: string; body: string }) {
  const now = new Date();
  const [row] = await db
    .insert(icebreakerAnswers)
    .values({ userId, ...day, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [icebreakerAnswers.userId, icebreakerAnswers.languageId, icebreakerAnswers.promptDate],
      set: { body: day.body, updatedAt: now },
    })
    .returning({ body: icebreakerAnswers.body, updatedAt: icebreakerAnswers.updatedAt });
  if (!row) throw new Error("Icebreaker answer was not saved");
  return row;
}

export async function deleteAnswer(userId: string, day: Day) {
  const deleted = await db
    .delete(icebreakerAnswers)
    .where(
      and(
        eq(icebreakerAnswers.userId, userId),
        eq(icebreakerAnswers.languageId, day.languageId),
        eq(icebreakerAnswers.promptDate, day.promptDate),
      ),
    )
    .returning({ id: icebreakerAnswers.id });
  return deleted.length > 0;
}
