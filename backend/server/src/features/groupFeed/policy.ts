import { AppError } from "../../shared/errors/AppError";
import { isModerator, type Membership } from "../groups/policy";

/**
 * Feed rules, free of I/O. Reading and writing need an active membership (checked with the
 * groups policy); deleting is for the author or a group owner/moderator.
 */
export function assertCanDelete(actorId: string, authorId: string, membership: Membership) {
  if (actorId === authorId || isModerator(membership)) {
    return;
  }
  throw new AppError("Only the author or a moderator can delete this", 403, "FORBIDDEN");
}
