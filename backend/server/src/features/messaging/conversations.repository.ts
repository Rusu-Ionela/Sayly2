import { and, count, desc, eq, inArray, isNotNull, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "../../db/client";
import { isUniqueViolation } from "../../db/errors";
import type { MessageStatus } from "../../db/schema";
import {
  conversationParticipants,
  conversations,
  directConversations,
  messages,
  profiles,
  users,
} from "../../db/schema";
import { AppError } from "../../shared/errors/AppError";
// Repository, not the safety barrel: the barrel loads routes → calls → messaging (import cycle).
import { assertNotBlocked } from "../safety/repository";
import { isConnectionAccepted } from "../connections/repository";
import { visibleCountry } from "../users/settings";

import { getPresenceMany } from "./presence";
import type {
  ConversationAccess,
  ConversationListItem,
  ConversationsPage,
  ListConversationsQuery,
} from "./types";
import { notBlockedBetween } from "../safety/blockFilter";
import { requireRow } from "../../db/helpers";

import { toMessageDto } from "./messageDto";

const me = alias(conversationParticipants, "me");
const partner = alias(conversationParticipants, "partner");

/** How many chats one person can pin; also the most the first list page carries. */
export const MAX_PINNED_CHATS = 3;

function encodeConversationCursor(sortAt: Date, conversationId: string) {
  return Buffer.from(`${sortAt.toISOString()}|${conversationId}`).toString("base64url");
}

function decodeConversationCursor(cursor: string): { sortAt: Date; conversationId: string } {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const separator = decoded.lastIndexOf("|");
    const iso = decoded.slice(0, separator);
    const conversationId = decoded.slice(separator + 1);
    const sortAt = new Date(iso);
    if (!conversationId || Number.isNaN(sortAt.getTime())) {
      throw new Error("invalid");
    }
    return { sortAt, conversationId };
  } catch {
    throw new AppError("Invalid cursor", 400, "VALIDATION_ERROR");
  }
}

export async function assertConversationMember(conversationId: string, userId: string) {
  const [membership] = await db
    .select({ conversationId: conversationParticipants.conversationId })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new AppError("Conversation not found", 404, "NOT_FOUND");
  }

  return membership;
}

export async function getOtherParticipantId(conversationId: string, userId: string) {
  const [other] = await db
    .select({ userId: conversationParticipants.userId })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        ne(conversationParticipants.userId, userId),
      ),
    )
    .limit(1);

  if (!other) {
    throw new AppError("Conversation partner not found", 404, "NOT_FOUND");
  }

  return other.userId;
}

function directPair(userA: string, userB: string) {
  return userA < userB
    ? { userLowId: userA, userHighId: userB }
    : { userLowId: userB, userHighId: userA };
}

export async function findDirectConversationId(userA: string, userB: string) {
  const pair = directPair(userA, userB);
  const [row] = await db
    .select({ conversationId: directConversations.conversationId })
    .from(directConversations)
    .where(
      and(
        eq(directConversations.userLowId, pair.userLowId),
        eq(directConversations.userHighId, pair.userHighId),
      ),
    )
    .limit(1);

  return row?.conversationId ?? null;
}

/**
 * Opens (or returns) the single DIRECT conversation between two users. A new chat requires
 * an accepted connection request; an existing legacy chat remains accessible.
 */
export async function getOrCreateDirectConversation(userId: string, otherUserId: string) {
  if (userId === otherUserId) {
    throw new AppError("You cannot message yourself", 400, "VALIDATION_ERROR");
  }

  const [callerRows, targetRows] = await Promise.all([
    db.select({ status: users.status }).from(users).where(eq(users.id, userId)).limit(1),
    db
      .select({ status: users.status })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(users.id, otherUserId))
      .limit(1),
  ]);
  const target = targetRows[0];

  if (callerRows[0]?.status !== "ACTIVE" || target?.status !== "ACTIVE") {
    throw new AppError("User not found", 404, "NOT_FOUND");
  }
  // Same 404 as a missing user so clients cannot probe block relationships.
  await assertNotBlocked(userId, otherUserId).catch(() => {
    throw new AppError("User not found", 404, "NOT_FOUND");
  });

  const existing = await findDirectConversationId(userId, otherUserId);
  if (existing) {
    return { conversationId: existing, created: false };
  }
  if (!(await isConnectionAccepted(userId, otherUserId))) {
    throw new AppError(
      "Accept a connection request before starting a chat",
      403,
      "CONNECTION_REQUIRED",
    );
  }

  const pair = directPair(userId, otherUserId);
  try {
    const conversationId = await db.transaction(async (tx) => {
      const [created] = await tx.insert(conversations).values({}).returning();
      const conversation = requireRow(created, "conversation");
      await tx.insert(conversationParticipants).values([
        { conversationId: conversation.id, userId },
        { conversationId: conversation.id, userId: otherUserId },
      ]);
      await tx.insert(directConversations).values({ ...pair, conversationId: conversation.id });
      return conversation.id;
    });
    return { conversationId, created: true };
  } catch (error) {
    // Lost a race with the other user opening the same chat: return the winner's conversation.
    if (isUniqueViolation(error)) {
      const winner = await findDirectConversationId(userId, otherUserId);
      if (winner) {
        return { conversationId: winner, created: false };
      }
    }
    throw error;
  }
}

export async function assertCanAccessConversation(
  conversationId: string,
  userId: string,
): Promise<ConversationAccess> {
  await assertConversationMember(conversationId, userId);
  const otherUserId = await getOtherParticipantId(conversationId, userId);

  const [caller, partner] = await Promise.all([
    db.select({ status: users.status }).from(users).where(eq(users.id, userId)).limit(1),
    db.select({ status: users.status }).from(users).where(eq(users.id, otherUserId)).limit(1),
  ]);

  if (caller[0]?.status !== "ACTIVE" || partner[0]?.status !== "ACTIVE") {
    throw new AppError("Conversation is unavailable", 403, "FORBIDDEN");
  }

  // Same 404 as an unknown conversation so a blocked user cannot tell they were blocked.
  await assertNotBlocked(userId, otherUserId).catch(() => {
    throw new AppError("Conversation not found", 404, "NOT_FOUND");
  });

  return { conversationId, otherUserId };
}

export async function listPartnerIds(userId: string, limit = 100): Promise<string[]> {
  const partnerId = sql<string>`case when ${directConversations.userLowId} = ${userId} then ${directConversations.userHighId} else ${directConversations.userLowId} end`;
  const rows = await db
    .select({ userId: partnerId })
    .from(directConversations)
    .innerJoin(users, eq(users.id, partnerId))
    .where(
      and(
        or(eq(directConversations.userLowId, userId), eq(directConversations.userHighId, userId)),
        eq(users.status, "ACTIVE"),
        notBlockedBetween(userId, users.id),
      ),
    )
    .limit(limit);

  return rows.map((row) => row.userId);
}

export async function assertCanSeePresence(viewerId: string, targetId: string) {
  if (viewerId === targetId) {
    return;
  }

  const [viewer, target] = await Promise.all([
    db.select({ status: users.status }).from(users).where(eq(users.id, viewerId)).limit(1),
    db.select({ status: users.status }).from(users).where(eq(users.id, targetId)).limit(1),
  ]);

  if (viewer[0]?.status !== "ACTIVE" || target[0]?.status !== "ACTIVE") {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }

  await assertNotBlocked(viewerId, targetId);

  // Presence is only shared between people who already have a chat together.
  if (!(await findDirectConversationId(viewerId, targetId))) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }
}

export async function persistLastSeen(userId: string, at: Date) {
  await db
    .update(users)
    .set({ lastSeenAt: at })
    .where(and(eq(users.id, userId), or(isNull(users.lastSeenAt), lt(users.lastSeenAt, at))));
}

export async function listConversations(
  userId: string,
  query: ListConversationsQuery,
): Promise<ConversationsPage> {
  const sortAtExpr = sql<Date>`COALESCE(${me.lastMessageAt}, ${conversations.lastMessageAt}, ${conversations.updatedAt})`;

  const cursor = query.cursor ? decodeConversationCursor(query.cursor) : null;
  const cursorFilter = cursor
    ? or(
      lt(sortAtExpr, cursor.sortAt),
      and(eq(sortAtExpr, cursor.sortAt), lt(me.conversationId, cursor.conversationId)),
    )
    : undefined;

  const selectRows = (extra: SQL | undefined, order: SQL[], limit: number) =>
    db
      .select({
        conversationId: me.conversationId,
        type: conversations.type,
        lastMessageId: conversations.lastMessageId,
        lastMessageAt: conversations.lastMessageAt,
        updatedAt: conversations.updatedAt,
        pinnedAt: me.pinnedAt,
        autoTranslate: me.autoTranslate,
        sortAt: sortAtExpr,
        partnerUserId: partner.userId,
        partnerDisplayName: profiles.displayName,
        partnerAvatar: profiles.profileImageUrl,
        partnerCountry: visibleCountry,
        partnerLastSeenAt: users.lastSeenAt,
      })
      .from(me)
      .innerJoin(conversations, eq(conversations.id, me.conversationId))
      .innerJoin(
        partner,
        and(eq(partner.conversationId, me.conversationId), ne(partner.userId, me.userId)),
      )
      .innerJoin(users, eq(users.id, partner.userId))
      .leftJoin(profiles, eq(profiles.userId, partner.userId))
      .where(
        and(
          eq(me.userId, userId),
          eq(conversations.type, "DIRECT"),
          eq(users.status, "ACTIVE"),
          notBlockedBetween(me.userId, partner.userId),
          extra,
        ),
      )
      .orderBy(...order)
      .limit(limit);

  // Pinned chats ride on the first page only; later pages continue the unpinned list.
  const [pinnedRows, regularRows] = await Promise.all([
    cursor ? Promise.resolve([]) : selectRows(isNotNull(me.pinnedAt), [desc(me.pinnedAt)], MAX_PINNED_CHATS),
    selectRows(
      and(isNull(me.pinnedAt), cursorFilter),
      [sql`${sortAtExpr} DESC`, desc(me.conversationId)],
      query.limit + 1,
    ),
  ]);
  const hasMore = regularRows.length > query.limit;
  const regularPage = hasMore ? regularRows.slice(0, query.limit) : regularRows;
  const pageRows = [...pinnedRows, ...regularPage];
  const conversationIds = pageRows.map((row) => row.conversationId);
  const lastMessageIds = pageRows
    .map((row) => row.lastMessageId)
    .filter((id): id is string => Boolean(id));

  const [lastMessageRows, unreadRows] = await Promise.all([
    lastMessageIds.length > 0
      ? db.select().from(messages).where(inArray(messages.id, lastMessageIds))
      : Promise.resolve([]),
    conversationIds.length > 0
      ? db
        .select({
          conversationId: messages.conversationId,
          value: count().as("value"),
        })
        .from(messages)
        .where(
          and(
            inArray(messages.conversationId, conversationIds),
            ne(messages.senderId, userId),
            inArray(messages.status, ["SENT", "DELIVERED"] satisfies MessageStatus[]),
          ),
        )
        .groupBy(messages.conversationId)
      : Promise.resolve([]),
  ]);

  const lastById = new Map(lastMessageRows.map((row) => [row.id, toMessageDto(row)]));
  const unreadById = new Map(unreadRows.map((row) => [row.conversationId, Number(row.value)]));
  const presenceByUser = await getPresenceMany(
    pageRows.map((row) => ({ userId: row.partnerUserId, persistedLastSeen: row.partnerLastSeenAt })),
  );

  const items: ConversationListItem[] = pageRows.map((row) => {
    const lastMessage = row.lastMessageId ? (lastById.get(row.lastMessageId) ?? null) : null;
    // No snapshot means presence could not be resolved — reveal nothing (fail closed).
    const presence = presenceByUser.get(row.partnerUserId) ?? {
      onlineStatus: "UNKNOWN" as const,
      lastSeen: null,
    };
    const avatarUrl = row.partnerAvatar ?? null;

    return {
      id: row.conversationId,
      type: "DIRECT",
      otherUser: {
        id: row.partnerUserId,
        displayName: row.partnerDisplayName ?? "Partner",
        avatarUrl,
        photoUrl: avatarUrl ?? undefined,
        country: row.partnerCountry ?? "",
        onlineStatus: presence.onlineStatus,
        lastSeen: presence.lastSeen,
      },
      lastMessage,
      unreadCount: unreadById.get(row.conversationId) ?? 0,
      lastMessageAt: row.lastMessageAt
        ? row.lastMessageAt.toISOString()
        : (lastMessage?.createdAt ?? null),
      updatedAt: (row.lastMessageAt ?? row.updatedAt).toISOString(),
      pinnedAt: row.pinnedAt?.toISOString() ?? null,
      autoTranslate: row.autoTranslate,
    };
  });

  const last = regularPage[regularPage.length - 1];
  const nextCursor =
    hasMore && last ? encodeConversationCursor(new Date(last.sortAt), last.conversationId) : null;

  return {
    items,
    nextCursor,
    hasMore,
    limit: query.limit,
  };
}

/** Turns automatic translation of incoming messages on or off, for this member only. */
export async function setConversationAutoTranslate(
  userId: string,
  conversationId: string,
  enabled: boolean,
) {
  await assertCanAccessConversation(conversationId, userId);
  await db
    .update(conversationParticipants)
    .set({ autoTranslate: enabled })
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
      ),
    );
  return { conversationId, autoTranslate: enabled };
}

/** Pins or unpins the chat for this user only. Pinning past the limit is a 409. */
export async function setConversationPinned(userId: string, conversationId: string, pinned: boolean) {
  await assertCanAccessConversation(conversationId, userId);

  if (pinned) {
    const [row] = await db
      .select({ total: count() })
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.userId, userId),
          isNotNull(conversationParticipants.pinnedAt),
          ne(conversationParticipants.conversationId, conversationId),
        ),
      );
    if ((row?.total ?? 0) >= MAX_PINNED_CHATS) {
      throw new AppError(`You can pin up to ${MAX_PINNED_CHATS} chats`, 409, "CONFLICT");
    }
  }

  await db
    .update(conversationParticipants)
    .set({ pinnedAt: pinned ? new Date() : null })
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
      ),
    );
  return { conversationId, pinned };
}

