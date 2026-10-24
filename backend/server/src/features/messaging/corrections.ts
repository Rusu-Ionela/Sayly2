import { desc, inArray } from "drizzle-orm";

import { db } from "../../db/client";
import { messageCorrections } from "../../db/schema";

import type { ChatMessage, MessageCorrectionDto } from "./types";

type CorrectionRow = typeof messageCorrections.$inferSelect;

export function toCorrectionDto(row: CorrectionRow): MessageCorrectionDto {
  return {
    id: row.id,
    messageId: row.messageId,
    authorId: row.authorId,
    correctedText: row.correctedText,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

/** The most recent correction of each message (one query for a whole page). */
export async function latestCorrectionsFor(
  messageIds: string[],
): Promise<Map<string, MessageCorrectionDto>> {
  const latest = new Map<string, MessageCorrectionDto>();
  if (messageIds.length === 0) return latest;

  const rows = await db
    .select()
    .from(messageCorrections)
    .where(inArray(messageCorrections.messageId, messageIds))
    .orderBy(desc(messageCorrections.createdAt));

  for (const row of rows) {
    if (!latest.has(row.messageId)) latest.set(row.messageId, toCorrectionDto(row));
  }
  return latest;
}

/** Adds `correction` (latest suggestion, or null) to every message of a page. */
export async function withLatestCorrections(items: ChatMessage[]): Promise<ChatMessage[]> {
  const latest = await latestCorrectionsFor(items.map((item) => item.id));
  return items.map((item) => ({ ...item, correction: latest.get(item.id) ?? null }));
}
