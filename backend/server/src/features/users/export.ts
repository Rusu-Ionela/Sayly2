import { asc, desc, eq } from "drizzle-orm";

import { db } from "../../db/client";
import { blocks, follows, messages, users } from "../../db/schema";
import { listSavedPhrases } from "../messaging/learning";
import { listReferencesWrittenBy } from "../references";
import { listSupportTickets } from "../support";
import { listTopics, toTopicDto } from "../topics/repository";

import type { CurrentUserDto } from "./types";

/** Newest sent messages included in an export (older ones are available from support). */
const MAX_EXPORTED_MESSAGES = 5_000;

/**
 * "Download my data" — everything Sayly keeps that the member created or chose, as one
 * JSON document. Other members' data (their messages, profiles) is never included.
 */
export async function buildDataExport(userId: string, profile: CurrentUserDto) {
  const [account, topics, phrases, following, blocked, sent, supportTickets, referencesWritten] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { createdAt: true, authProvider: true, lastSeenAt: true },
    }),
    listTopics(userId),
    listSavedPhrases(userId),
    db
      .select({ userId: follows.followeeId, since: follows.createdAt })
      .from(follows)
      .where(eq(follows.followerId, userId))
      .orderBy(asc(follows.createdAt)),
    db
      .select({ userId: blocks.blockedId, since: blocks.createdAt })
      .from(blocks)
      .where(eq(blocks.blockerId, userId))
      .orderBy(asc(blocks.createdAt)),
    db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        type: messages.type,
        content: messages.content,
        caption: messages.caption,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.senderId, userId))
      .orderBy(desc(messages.createdAt))
      .limit(MAX_EXPORTED_MESSAGES),
    listSupportTickets(userId),
    listReferencesWrittenBy(userId),
  ]);

  const { stats: _stats, ...profileData } = profile;

  return {
    exportedAt: new Date().toISOString(),
    account: {
      createdAt: account?.createdAt.toISOString() ?? null,
      signInMethod: account?.authProvider ?? null,
      lastSeenAt: account?.lastSeenAt?.toISOString() ?? null,
    },
    profile: profileData,
    conversationTopics: topics.map(toTopicDto),
    collection: phrases.items,
    following: following.map((row) => ({ userId: row.userId, since: row.since.toISOString() })),
    blockedUsers: blocked.map((row) => ({ userId: row.userId, since: row.since.toISOString() })),
    supportTickets,
    referencesWritten: referencesWritten.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
    sentMessages: {
      limit: MAX_EXPORTED_MESSAGES,
      items: sent.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    },
  };
}
