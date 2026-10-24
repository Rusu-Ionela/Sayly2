import { logger } from "../../shared/utils/logger";

import { insertInboxItem } from "./inbox.repository";
import type { NewInboxItem } from "./types";

/** Fire-and-forget: a failed inbox write must never fail the action that caused it. */
function record(item: NewInboxItem) {
  void insertInboxItem(item).catch((error: unknown) =>
    logger.warn("notifications", "inbox write failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    }),
  );
}

export function recordReference(authorId: string, subjectId: string) {
  record({
    userId: subjectId,
    actorId: authorId,
    type: "REFERENCE",
    dedupeKey: `reference:${authorId}:${subjectId}`,
  });
}

export function recordCorrection(
  correctionId: string,
  authorId: string,
  messageSenderId: string,
  conversationId: string,
) {
  record({
    userId: messageSenderId,
    actorId: authorId,
    type: "CORRECTION",
    conversationId,
    dedupeKey: `correction:${correctionId}`,
  });
}
