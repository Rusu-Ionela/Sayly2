import { and, count, desc, eq, inArray, isNull, lt, ne, or } from "drizzle-orm";

import { db } from "../../db/client";
import { isUniqueViolation } from "../../db/errors";
import type { MessageStatus, MessageType } from "../../db/schema";
import {
  conversationParticipants,
  conversations,
  messages,
  messageTranslations,
} from "../../db/schema";
import { AppError } from "../../shared/errors/AppError";
import { requireOwnedMediaPath } from "../media/service";

import { withLatestCorrections } from "./corrections";
import type {
  ChatMessage,
  ListMessagesQuery,
  MessageRow,
  MessagesPage,
  SendMessageInput,
  SendMessageResult,
} from "./types";
import { requireRow } from "../../db/helpers";
import { notBlockedBetween } from "../safety/blockFilter";

import { toMessageDto } from "./messageDto";
import {
  assertCanAccessConversation,
  getOrCreateDirectConversation,
} from "./conversations.repository";

export async function listMessages(
  userId: string,
  conversationId: string,
  query: ListMessagesQuery,
): Promise<MessagesPage> {
  await assertCanAccessConversation(conversationId, userId);

  if (query.before) {
    return listMessagesByCursor(conversationId, query.before, query.limit);
  }

  if (query.page) {
    return listMessagesByOffset(conversationId, query.page, query.limit);
  }

  return listMessagesByCursor(conversationId, undefined, query.limit);
}

async function listMessagesByCursor(
  conversationId: string,
  before: string | undefined,
  limit: number,
): Promise<MessagesPage> {
  let cursor: { createdAt: Date; id: string } | undefined;

  if (before) {
    const [anchor] = await db
      .select({ id: messages.id, createdAt: messages.createdAt })
      .from(messages)
      .where(and(eq(messages.id, before), eq(messages.conversationId, conversationId)))
      .limit(1);

    if (!anchor) {
      throw new AppError("Invalid cursor", 400, "VALIDATION_ERROR");
    }

    cursor = anchor;
  }

  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        cursor
          ? or(
            lt(messages.createdAt, cursor.createdAt),
            and(eq(messages.createdAt, cursor.createdAt), lt(messages.id, cursor.id)),
          )
          : undefined,
      ),
    )
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const oldest = pageRows[pageRows.length - 1];

  return {
    items: await withLatestCorrections(pageRows.map(toMessageDto).reverse()),
    nextCursor: hasMore && oldest ? oldest.id : null,
    hasMore,
    limit,
  };
}

async function listMessagesByOffset(
  conversationId: string,
  page: number,
  limit: number,
): Promise<MessagesPage> {
  const where = eq(messages.conversationId, conversationId);
  const [[totalRow], rows] = await Promise.all([
    db.select({ value: count() }).from(messages).where(where),
    db
      .select()
      .from(messages)
      .where(where)
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .offset((page - 1) * limit)
      .limit(limit),
  ]);

  const total = totalRow?.value ?? 0;
  const hasMore = page * limit < total;
  const oldest = rows[rows.length - 1];

  return {
    items: await withLatestCorrections(rows.map(toMessageDto).reverse()),
    nextCursor: hasMore && oldest ? oldest.id : null,
    hasMore,
    limit,
    page,
    total,
  };
}

/** Persists a message and moves the conversation's "latest" pointers, atomically. */
async function insertMessage(values: typeof messages.$inferInsert) {
  const { conversationId } = values;
  return db.transaction(async (tx) => {
    await tx
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .for("update")
      .limit(1);

    const [created] = await tx.insert(messages).values(values).returning();
    const saved = requireRow(created, "message");

    await tx
      .update(conversations)
      .set({
        lastMessageId: saved.id,
        lastMessageAt: saved.createdAt,
        updatedAt: saved.createdAt,
      })
      .where(
        and(
          eq(conversations.id, conversationId),
          or(
            isNull(conversations.lastMessageAt),
            lt(conversations.lastMessageAt, saved.createdAt),
            and(eq(conversations.lastMessageAt, saved.createdAt), lt(conversations.lastMessageId, saved.id)),
          ),
        ),
      );

    await tx
      .update(conversationParticipants)
      .set({ lastMessageAt: saved.createdAt })
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          or(
            isNull(conversationParticipants.lastMessageAt),
            lt(conversationParticipants.lastMessageAt, saved.createdAt),
          ),
        ),
      );

    return saved;
  });
}

/** Body of the silent "followed you" chat notice; clients render the sentence themselves. */
export const FOLLOW_NOTICE = "FOLLOW";

/**
 * Drops a silent system message from the follower into the pair's chat. Stored once per
 * follower→followee (unfollow and refollow do not repeat it); never pushed or emitted.
 */
export async function postFollowNotice(followerId: string, followeeId: string) {
  const { conversationId } = await getOrCreateDirectConversation(followerId, followeeId);
  try {
    await insertMessage({
      conversationId,
      senderId: followerId,
      type: "SYSTEM",
      content: FOLLOW_NOTICE,
      clientMessageId: `follow-notice:${followeeId}`,
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
}

export async function sendMessage(userId: string, input: SendMessageInput): Promise<SendMessageResult> {
  const { otherUserId } = await assertCanAccessConversation(input.conversationId, userId);
  const type: MessageType = input.type ?? "TEXT";
  const clientMessageId = input.clientMessageId?.trim() || null;
  const caption = input.caption?.trim() || null;
  const storedContent =
    type === "TEXT" ? input.content : await requireOwnedMediaPath(userId, input.content);
  // "video-note" is the client's round-video marker, not a URL.
  const storedThumbnail = !input.thumbnailUrl
    ? null
    : input.thumbnailUrl === "video-note"
      ? input.thumbnailUrl
      : await requireOwnedMediaPath(userId, input.thumbnailUrl);

  function samePayload(prior: MessageRow) {
    return (
      prior.conversationId === input.conversationId &&
      prior.type === type &&
      prior.content === storedContent &&
      prior.caption === caption &&
      (prior.durationMs ?? null) === (input.durationMs ?? null) &&
      (prior.mimeType ?? null) === (input.mimeType ?? null) &&
      (prior.thumbnailUrl ?? null) === storedThumbnail
    );
  }

  if (clientMessageId) {
    const existing = await db
      .select()
      .from(messages)
      .where(and(eq(messages.senderId, userId), eq(messages.clientMessageId, clientMessageId)))
      .limit(1);
    const prior = existing[0];
    if (prior) {
      if (!samePayload(prior)) {
        throw new AppError("Idempotency key reused for different input", 409, "CONFLICT");
      }
      return { message: toMessageDto(prior), recipientId: otherUserId, created: false };
    }
  }

  try {
    const message = await insertMessage({
      conversationId: input.conversationId,
      senderId: userId,
      type,
      content: storedContent,
      status: "SENT",
      durationMs: input.durationMs ?? null,
      mimeType: input.mimeType ?? null,
      thumbnailUrl: storedThumbnail,
      caption,
      clientMessageId,
    });

    return {
      message: toMessageDto(message),
      recipientId: otherUserId,
      created: true,
    };
  } catch (error) {
    if (clientMessageId && isUniqueViolation(error)) {
      const [prior] = await db
        .select()
        .from(messages)
        .where(and(eq(messages.senderId, userId), eq(messages.clientMessageId, clientMessageId)))
        .limit(1);
      if (prior && samePayload(prior)) {
        return { message: toMessageDto(prior), recipientId: otherUserId, created: false };
      }
      throw new AppError("Idempotency key reused for different input", 409, "CONFLICT");
    }
    throw error;
  }
}

export async function markMessagesDelivered(messageIds: string[]) {
  if (messageIds.length === 0) return [];

  await db
    .update(messages)
    .set({ status: "DELIVERED" })
    .where(and(inArray(messages.id, messageIds), eq(messages.status, "SENT")));

  const rows = await db.select().from(messages).where(inArray(messages.id, messageIds));
  return rows.map(toMessageDto);
}

/** Most messages promoted per reconnect; older ones still turn READ when the chat is opened. */
const PENDING_DELIVERY_LIMIT = 200;

/**
 * Called when a user comes online: direct messages sent to them while they were offline
 * become DELIVERED. Blocked pairs are skipped so a receipt never reveals presence.
 */
export async function markPendingDelivered(recipientId: string): Promise<ChatMessage[]> {
  const pending = await db
    .select({ id: messages.id })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .innerJoin(
      conversationParticipants,
      and(
        eq(conversationParticipants.conversationId, messages.conversationId),
        eq(conversationParticipants.userId, recipientId),
      ),
    )
    .where(
      and(
        eq(conversations.type, "DIRECT"),
        eq(messages.status, "SENT"),
        ne(messages.senderId, recipientId),
        notBlockedBetween(messages.senderId, recipientId),
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(PENDING_DELIVERY_LIMIT);

  if (pending.length === 0) return [];

  const rows = await db
    .update(messages)
    .set({ status: "DELIVERED" })
    .where(and(inArray(messages.id, pending.map((row) => row.id)), eq(messages.status, "SENT")))
    .returning();
  return rows.map(toMessageDto);
}

export async function markMessagesRead(
  userId: string,
  conversationId: string,
  messageIds?: string[],
) {
  await assertCanAccessConversation(conversationId, userId);

  if (messageIds && messageIds.length === 0) {
    return { messages: [] as ChatMessage[], senderIds: [] as string[] };
  }

  if (messageIds && messageIds.length > 100) {
    throw new AppError("Too many message ids", 400, "VALIDATION_ERROR");
  }

  const conditions = [
    eq(messages.conversationId, conversationId),
    ne(messages.senderId, userId),
    inArray(messages.status, ["SENT", "DELIVERED"] satisfies MessageStatus[]),
  ];

  if (messageIds?.length) {
    conditions.push(inArray(messages.id, messageIds));
  }

  const updatedMessages = await db
    .update(messages)
    .set({ status: "READ" })
    .where(and(...conditions))
    .returning();

  return {
    messages: updatedMessages.map(toMessageDto),
    senderIds: [...new Set(updatedMessages.map((row) => row.senderId))],
  };
}

export async function getAccessibleMessage(userId: string, conversationId: string, messageId: string) {
  await assertCanAccessConversation(conversationId, userId);
  const [row] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)))
    .limit(1);

  if (!row) {
    throw new AppError("Message not found", 404, "NOT_FOUND");
  }

  return row;
}

export async function findTranslation(input: {
  messageId: string;
  targetLang: string;
  sourceHash: string;
  providerVersion?: string;
}) {
  const filters = [
    eq(messageTranslations.messageId, input.messageId),
    eq(messageTranslations.targetLang, input.targetLang),
    eq(messageTranslations.sourceHash, input.sourceHash),
  ];
  if (input.providerVersion) {
    filters.push(eq(messageTranslations.providerVersion, input.providerVersion));
  }

  const [row] = await db
    .select()
    .from(messageTranslations)
    .where(and(...filters))
    .orderBy(desc(messageTranslations.updatedAt))
    .limit(1);

  return row ?? null;
}

/** Cached translations of many messages into one language by one provider version, newest first. */
export async function findTranslationsFor(
  messageIds: string[],
  targetLang: string,
  providerVersion: string,
) {
  if (messageIds.length === 0) return [];
  return db
    .select({
      messageId: messageTranslations.messageId,
      sourceHash: messageTranslations.sourceHash,
      targetLang: messageTranslations.targetLang,
      text: messageTranslations.text,
    })
    .from(messageTranslations)
    .where(
      and(
        inArray(messageTranslations.messageId, messageIds),
        eq(messageTranslations.targetLang, targetLang),
        eq(messageTranslations.providerVersion, providerVersion),
      ),
    )
    .orderBy(desc(messageTranslations.updatedAt));
}

export async function saveMessageTranslation(input: {
  messageId: string;
  targetLang: string;
  sourceHash: string;
  providerVersion: string;
  text: string;
}) {
  try {
    const [row] = await db
      .insert(messageTranslations)
      .values({
        messageId: input.messageId,
        targetLang: input.targetLang,
        sourceHash: input.sourceHash,
        providerVersion: input.providerVersion,
        text: input.text,
      })
      .returning();
    return requireRow(row, "message translation");
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
    const existing = await findTranslation(input);
    if (!existing) {
      throw error;
    }
    return existing;
  }
}

export async function saveTranscript(messageId: string, transcript: string) {
  const [row] = await db
    .update(messages)
    .set({ transcript, updatedAt: new Date() })
    .where(eq(messages.id, messageId))
    .returning();
  return toMessageDto(requireRow(row, "message"));
}
