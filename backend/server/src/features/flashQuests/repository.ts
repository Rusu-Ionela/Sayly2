import { and, asc, count, eq, gt, lt, ne, or, type SQL } from "drizzle-orm";
import { FLASH_QUEST_SEARCH_TIMEOUT_MS } from "@sayly/shared";

import { db, type DbTransaction } from "../../db/client";
import { flashQuestMessages, flashQuests, languages, users, type FlashQuest } from "../../db/schema";
import { notBlockedBetween } from "../safety/blockFilter";

const searchCutoff = (now: Date) => new Date(now.getTime() - FLASH_QUEST_SEARCH_TIMEOUT_MS);

const participant = (userId: string) => or(eq(flashQuests.hostId, userId), eq(flashQuests.guestId, userId));

/** A search still within its time limit, or a quest whose timer is still running. */
const stillOpen = (now: Date) =>
  or(
    and(eq(flashQuests.status, "SEARCHING"), gt(flashQuests.createdAt, searchCutoff(now))),
    and(eq(flashQuests.status, "ACTIVE"), gt(flashQuests.endsAt, now)),
  );

export async function findQuestFor(userId: string, questId: string): Promise<FlashQuest | null> {
  const [row] = await db
    .select()
    .from(flashQuests)
    .where(and(eq(flashQuests.id, questId), participant(userId)))
    .limit(1);
  return row ?? null;
}

export async function findOpenQuestFor(userId: string, now: Date): Promise<FlashQuest | null> {
  const [row] = await db
    .select()
    .from(flashQuests)
    .where(and(participant(userId), stillOpen(now)))
    .orderBy(asc(flashQuests.createdAt))
    .limit(1);
  return row ?? null;
}

/**
 * Locks the oldest open search for `languageId` that `userId` may join: someone else's,
 * an active host, no block either way. SKIP LOCKED lets parallel searches pick different hosts.
 * `olderThan` restricts it to searches that started before the caller's own.
 */
async function lockJoinableSearch(
  tx: DbTransaction,
  userId: string,
  languageId: string,
  now: Date,
  olderThan?: FlashQuest,
): Promise<FlashQuest | null> {
  const conditions: (SQL | undefined)[] = [
    eq(flashQuests.languageId, languageId),
    eq(flashQuests.status, "SEARCHING"),
    gt(flashQuests.createdAt, searchCutoff(now)),
    ne(flashQuests.hostId, userId),
    eq(users.status, "ACTIVE"),
    notBlockedBetween(userId, flashQuests.hostId),
  ];
  if (olderThan) {
    conditions.push(
      or(
        lt(flashQuests.createdAt, olderThan.createdAt),
        and(eq(flashQuests.createdAt, olderThan.createdAt), lt(flashQuests.id, olderThan.id)),
      ),
    );
  }
  const [row] = await tx
    .select({ quest: flashQuests })
    .from(flashQuests)
    .innerJoin(users, eq(users.id, flashQuests.hostId))
    .where(and(...conditions))
    .orderBy(asc(flashQuests.createdAt), asc(flashQuests.id))
    .limit(1)
    .for("update", { of: flashQuests, skipLocked: true });
  return row?.quest ?? null;
}

async function joinQuest(tx: DbTransaction, questId: string, guestId: string, now: Date, durationMs: number) {
  const [joined] = await tx
    .update(flashQuests)
    .set({ guestId, status: "ACTIVE", startedAt: now, endsAt: new Date(now.getTime() + durationMs) })
    .where(and(eq(flashQuests.id, questId), eq(flashQuests.status, "SEARCHING")))
    .returning();
  return joined ?? null;
}

/** Joins the oldest waiting partner, or opens a new search when nobody is waiting. */
export async function matchOrCreate(input: {
  userId: string;
  languageId: string;
  promptId: string;
  challengeId: string;
  now: Date;
  durationMs: number;
}): Promise<{ quest: FlashQuest; matched: boolean }> {
  return db.transaction(async (tx) => {
    const waiting = await lockJoinableSearch(tx, input.userId, input.languageId, input.now);
    if (waiting) {
      const joined = await joinQuest(tx, waiting.id, input.userId, input.now, input.durationMs);
      if (joined) return { quest: joined, matched: true };
    }
    const [created] = await tx
      .insert(flashQuests)
      .values({
        languageId: input.languageId,
        hostId: input.userId,
        status: "SEARCHING",
        promptId: input.promptId,
        challengeId: input.challengeId,
        createdAt: input.now,
      })
      .returning();
    if (!created) throw new Error("Flash quest was not created");
    return { quest: created, matched: false };
  });
}

/**
 * Two members who searched at the same moment each opened a search. On a poll, the newer
 * search joins the older one and closes itself, so the pair meets on the next poll.
 */
export async function joinOlderSearch(
  own: FlashQuest,
  now: Date,
  durationMs: number,
): Promise<FlashQuest | null> {
  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(flashQuests)
      .where(and(eq(flashQuests.id, own.id), eq(flashQuests.status, "SEARCHING")))
      .limit(1)
      .for("update", { skipLocked: true });
    if (!locked || locked.guestId) return null;

    const older = await lockJoinableSearch(tx, own.hostId, own.languageId, now, locked);
    if (!older) return null;
    const joined = await joinQuest(tx, older.id, own.hostId, now, durationMs);
    if (!joined) return null;
    await tx.update(flashQuests).set({ status: "CANCELLED" }).where(eq(flashQuests.id, own.id));
    return joined;
  });
}

export async function cancelQuest(questId: string): Promise<FlashQuest | null> {
  const [row] = await db
    .update(flashQuests)
    .set({ status: "CANCELLED" })
    .where(and(eq(flashQuests.id, questId), ne(flashQuests.status, "CANCELLED")))
    .returning();
  return row ?? null;
}

export async function setWantsConnect(questId: string, role: "host" | "guest"): Promise<FlashQuest | null> {
  const [row] = await db
    .update(flashQuests)
    .set(role === "host" ? { hostWantsConnect: true } : { guestWantsConnect: true })
    .where(eq(flashQuests.id, questId))
    .returning();
  return row ?? null;
}

export async function listMessages(questId: string) {
  return db
    .select({
      id: flashQuestMessages.id,
      senderId: flashQuestMessages.senderId,
      body: flashQuestMessages.body,
      createdAt: flashQuestMessages.createdAt,
    })
    .from(flashQuestMessages)
    .where(eq(flashQuestMessages.questId, questId))
    .orderBy(asc(flashQuestMessages.createdAt), asc(flashQuestMessages.id));
}

export async function countMessages(questId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(flashQuestMessages)
    .where(eq(flashQuestMessages.questId, questId));
  return row?.total ?? 0;
}

export async function insertMessage(questId: string, senderId: string, body: string) {
  await db.insert(flashQuestMessages).values({ questId, senderId, body, createdAt: new Date() });
}

export async function languageName(languageId: string): Promise<string> {
  const [row] = await db
    .select({ name: languages.name })
    .from(languages)
    .where(eq(languages.id, languageId))
    .limit(1);
  return row?.name ?? languageId;
}

/** Quests (and their chat) are short-lived; drop them after a week. */
export async function pruneOldFlashQuests(now: Date = new Date()) {
  await db
    .delete(flashQuests)
    .where(lt(flashQuests.createdAt, new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)));
}
