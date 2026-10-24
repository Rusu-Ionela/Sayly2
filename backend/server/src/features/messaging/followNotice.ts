import { AppError } from "../../shared/errors/AppError";
import { logger } from "../../shared/utils/logger";

import { postFollowNotice } from "./repository";

/**
 * Fire-and-forget: tells the followee, inside the chat, that someone followed them.
 * Silent by design (no push, no socket event). A user who cannot be chatted with
 * (hidden profile, blocked) simply gets no notice; the follow itself is unaffected.
 */
export function announceFollow(followerId: string, followeeId: string) {
  void postFollowNotice(followerId, followeeId).catch((error: unknown) => {
    if (error instanceof AppError) return;
    logger.warn("messaging", "follow notice failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  });
}
