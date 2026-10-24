import { env } from "../config/env";
import { getRedis, getRedisSubscriber } from "../infra/redis/client";
import { revocationChannel } from "../infra/redis/keys";
import { invalidateAuthCache } from "../shared/middleware/authenticate";
import { logger } from "../shared/utils/logger";

export type RevocationEvent =
  | { type: "user"; userId: string }
  | { type: "family"; userId: string; familyId: string };

type UserSocketRevoker = (userId: string) => void;
type FamilySocketRevoker = (userId: string, familyId: string) => void;

let revokeUserSocketsHandler: UserSocketRevoker = () => undefined;
let revokeFamilySocketsHandler: FamilySocketRevoker = () => undefined;

export function setUserSocketRevoker(handler: UserSocketRevoker) {
  revokeUserSocketsHandler = handler;
}

export function setFamilySocketRevoker(handler: FamilySocketRevoker) {
  revokeFamilySocketsHandler = handler;
}

function applyRevocation(event: RevocationEvent) {
  invalidateAuthCache(event.userId);
  if (event.type === "family") {
    revokeFamilySocketsHandler(event.userId, event.familyId);
    return;
  }
  revokeUserSocketsHandler(event.userId);
}

function isRevocationEvent(value: unknown): value is RevocationEvent {
  if (!value || typeof value !== "object") {
    return false;
  }
  const event = value as { type?: unknown; userId?: unknown; familyId?: unknown };
  if (typeof event.userId !== "string" || event.userId.length === 0) {
    return false;
  }
  if (event.type === "user") {
    return true;
  }
  return event.type === "family" && typeof event.familyId === "string" && event.familyId.length > 0;
}

export async function publishRevocation(event: RevocationEvent) {
  try {
    await getRedis().publish(revocationChannel(), JSON.stringify(event));
  } catch (error) {
    logger.warn("revocation", "publish failed; durable session checks still apply", {
      type: event.type,
      userId: event.userId,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export function revokeUserSockets(userId: string) {
  applyRevocation({ type: "user", userId });
  void publishRevocation({ type: "user", userId });
}

export function revokeFamilySockets(userId: string, familyId: string) {
  applyRevocation({ type: "family", userId, familyId });
  void publishRevocation({ type: "family", userId, familyId });
}

export async function subscribeToRevocation() {
  await getRedisSubscriber().subscribe(revocationChannel(), (raw) => {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isRevocationEvent(parsed)) {
        return;
      }
      applyRevocation(parsed);
    } catch (error) {
      logger.warn("revocation", "ignored malformed revocation payload", {
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
  logger.info("revocation", "subscribed", { env: env.nodeEnv });
}
