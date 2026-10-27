import { and, desc, eq, ne, sql } from "drizzle-orm";
import type { CreateTopicInput } from "@sayly/shared";

import { db, type DbTransaction } from "../../db/client";
import { conversationTopics, users, type ConversationTopic } from "../../db/schema";
import { AppError } from "../../shared/errors/AppError";

import type { ConversationTopicDto } from "./types";

export function toTopicDto(row: ConversationTopic): ConversationTopicDto {
  return {
    id: row.id,
    title: row.title,
    isMain: row.isMain,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Main topic first, then newest first. */
export function listTopics(userId: string) {
  return db
    .select()
    .from(conversationTopics)
    .where(eq(conversationTopics.userId, userId))
    .orderBy(desc(conversationTopics.isMain), desc(conversationTopics.createdAt));
}

/** Serialises topic writes per user so the count limit and "one main" hold under races. */
async function lockOwner(tx: DbTransaction, userId: string) {
  await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update").limit(1);
}

async function clearMain(tx: DbTransaction, userId: string, except?: string) {
  await tx
    .update(conversationTopics)
    .set({ isMain: false })
    .where(
      and(
        eq(conversationTopics.userId, userId),
        eq(conversationTopics.isMain, true),
        except ? ne(conversationTopics.id, except) : undefined,
      ),
    );
}

/** The first topic is always the main one; later ones only when asked. */
export async function createTopic(userId: string, input: CreateTopicInput, max: number) {
  return db.transaction(async (tx) => {
    await lockOwner(tx, userId);

    const existing = await tx
      .select({ title: conversationTopics.title })
      .from(conversationTopics)
      .where(eq(conversationTopics.userId, userId));

    if (existing.length >= max) {
      throw new AppError(`You can have up to ${max} topics`, 400, "VALIDATION_ERROR");
    }
    const wanted = input.title.toLocaleLowerCase();
    if (existing.some((row) => row.title.toLocaleLowerCase() === wanted)) {
      throw new AppError("You already have this topic", 409, "CONFLICT");
    }

    const isMain = existing.length === 0 || input.isMain === true;
    if (isMain) {
      await clearMain(tx, userId);
    }
    const [row] = await tx
      .insert(conversationTopics)
      .values({ userId, title: input.title, isMain })
      .returning();
    return row!;
  });
}

export async function setMainTopic(userId: string, topicId: string) {
  await db.transaction(async (tx) => {
    await lockOwner(tx, userId);
    await clearMain(tx, userId, topicId);
    const updated = await tx
      .update(conversationTopics)
      .set({ isMain: true })
      .where(and(eq(conversationTopics.id, topicId), eq(conversationTopics.userId, userId)))
      .returning({ id: conversationTopics.id });
    if (updated.length === 0) {
      throw new AppError("Topic not found", 404, "NOT_FOUND");
    }
  });
}

/** Deleting the main topic promotes the newest remaining one, so a main always exists. */
export async function deleteTopic(userId: string, topicId: string) {
  await db.transaction(async (tx) => {
    await lockOwner(tx, userId);
    const [deleted] = await tx
      .delete(conversationTopics)
      .where(and(eq(conversationTopics.id, topicId), eq(conversationTopics.userId, userId)))
      .returning({ isMain: conversationTopics.isMain });
    if (!deleted) {
      throw new AppError("Topic not found", 404, "NOT_FOUND");
    }
    if (deleted.isMain) {
      await tx
        .update(conversationTopics)
        .set({ isMain: true })
        .where(
          eq(
            conversationTopics.id,
            sql`(select ${conversationTopics.id} from ${conversationTopics}
                 where ${conversationTopics.userId} = ${userId}
                 order by ${conversationTopics.createdAt} desc limit 1)`,
          ),
        );
    }
  });
}
