import { createHmac, randomUUID } from "crypto";

import { CALL_KINDS, type CallEndReason, type CallKind } from "@sayly/shared";
import { z } from "zod";

import { env } from "../../config/env";
import { getRedis } from "../../infra/redis/client";
import { callKey, callUserKey } from "../../infra/redis/keys";
import { AppError } from "../../shared/errors/AppError";
import { isOnline } from "../messaging/presence";
import { assertCanAccessConversation } from "../messaging/service";
import { isInPartyRoom } from "../partyRooms/repository";

/** Unanswered calls disappear from Redis on their own, so a crash can't leave anyone "busy". */
export const RINGING_TTL_MS = 90_000;
/** Hard cap on one call; refreshed by the participants' own activity never, so it is the maximum. */
export const ACTIVE_TTL_MS = 4 * 60 * 60 * 1000;

const recordSchema = z.object({
  callId: z.string(),
  conversationId: z.string(),
  callerId: z.string(),
  calleeId: z.string(),
  kind: z.enum(CALL_KINDS),
  status: z.enum(["RINGING", "ACTIVE"]),
});
export type CallRecord = z.infer<typeof recordSchema>;

export type EndReason = CallEndReason;

async function readRecord(callId: string): Promise<CallRecord | null> {
  const raw = await getRedis().get(callKey(callId));
  if (!raw) {
    return null;
  }
  const parsed = recordSchema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : null;
}

/** Loads a live call the user takes part in; 404 for unknown or foreign calls. */
export async function getCallForParticipant(callId: string, userId: string): Promise<CallRecord> {
  const record = await readRecord(callId);
  if (!record || (record.callerId !== userId && record.calleeId !== userId)) {
    throw new AppError("Call not found", 404, "NOT_FOUND");
  }
  return record;
}

export function otherParty(record: CallRecord, userId: string) {
  return record.callerId === userId ? record.calleeId : record.callerId;
}

/**
 * Starts a ring. Both people must be free, and the callee must be online:
 * there is no push, so an offline callee could never answer.
 */
export async function startCall(input: {
  callerId: string;
  conversationId: string;
  kind: CallKind;
}): Promise<CallRecord> {
  const access = await assertCanAccessConversation(input.conversationId, input.callerId);
  const calleeId = access.otherUserId;

  if (!(await isOnline(calleeId))) {
    throw new AppError("They're offline right now", 409, "CALLEE_OFFLINE");
  }
  // A Party Room already holds the microphone of whoever is in one.
  if (await isInPartyRoom(input.callerId)) {
    throw new AppError("Leave your party room before calling", 409, "CALL_BUSY");
  }
  if (await isInPartyRoom(calleeId)) {
    throw new AppError("They're in a party room right now", 409, "CALL_BUSY");
  }

  const redis = getRedis();
  const callId = randomUUID();

  if ((await redis.set(callUserKey(input.callerId), callId, { px: RINGING_TTL_MS, nx: true })) === null) {
    throw new AppError("You're already in a call", 409, "CALL_BUSY");
  }
  if ((await redis.set(callUserKey(calleeId), callId, { px: RINGING_TTL_MS, nx: true })) === null) {
    await redis.del(callUserKey(input.callerId));
    throw new AppError("They're on another call", 409, "CALL_BUSY");
  }

  const record: CallRecord = {
    callId,
    conversationId: input.conversationId,
    callerId: input.callerId,
    calleeId,
    kind: input.kind,
    status: "RINGING",
  };
  await redis.set(callKey(callId), JSON.stringify(record), { px: RINGING_TTL_MS });
  return record;
}

/** Only the callee can answer, and only while it is still ringing. */
export async function acceptCall(callId: string, userId: string): Promise<CallRecord> {
  const record = await getCallForParticipant(callId, userId);
  if (record.calleeId !== userId) {
    throw new AppError("Only the person being called can answer", 403, "FORBIDDEN");
  }
  if (record.status !== "RINGING") {
    throw new AppError("This call is no longer ringing", 409, "CONFLICT");
  }

  const active: CallRecord = { ...record, status: "ACTIVE" };
  const redis = getRedis();
  await redis.set(callKey(callId), JSON.stringify(active), { px: ACTIVE_TTL_MS });
  await redis.pexpire(callUserKey(record.callerId), ACTIVE_TTL_MS);
  await redis.pexpire(callUserKey(record.calleeId), ACTIVE_TTL_MS);
  return active;
}

/** The callee rejects a call that is still ringing. */
export async function declineCall(callId: string, userId: string): Promise<CallRecord> {
  const record = await getCallForParticipant(callId, userId);
  if (record.calleeId !== userId) {
    throw new AppError("Only the person being called can decline", 403, "FORBIDDEN");
  }
  if (record.status !== "RINGING") {
    throw new AppError("This call is no longer ringing", 409, "CONFLICT");
  }
  return (await endCall(callId, userId, "declined")).record;
}

/** Ends or cancels a call and frees both people. Idempotent: an already-ended call is a 404. */
export async function endCall(
  callId: string,
  userId: string,
  forcedReason?: EndReason,
): Promise<{ record: CallRecord; reason: EndReason }> {
  const record = await getCallForParticipant(callId, userId);
  const reason: EndReason =
    forcedReason ??
    (record.status === "ACTIVE" ? "ended" : record.callerId === userId ? "cancelled" : "declined");

  await getRedis().del(
    callKey(callId),
    callUserKey(record.callerId),
    callUserKey(record.calleeId),
  );
  return { record, reason };
}

/** Ends the call between two people, if they are on one together. Returns it so callers can notify. */
export async function endCallBetween(userA: string, userB: string): Promise<CallRecord | null> {
  const callId = await currentCallId(userA);
  const record = callId ? await readRecord(callId) : null;
  if (!callId || !record || otherParty(record, userA) !== userB) {
    return null;
  }
  return (await endCall(callId, userA, "ended")).record;
}

/** The call a user is currently in, if any (used when their last socket drops). */
export async function currentCallId(userId: string): Promise<string | null> {
  return getRedis().get(callUserKey(userId));
}

export type IceServer = { urls: string[]; username?: string; credential?: string };

/**
 * STUN for everyone; TURN with short-lived coturn credentials when configured.
 * shortcut: without TURN_URLS calls fail behind strict NATs and some mobile carriers; host a coturn server before launch.
 */
export function iceServers(userId: string, now = Date.now()): IceServer[] {
  const servers: IceServer[] = [{ urls: env.iceStunUrls }];
  if (env.turnUrls.length > 0 && env.turnSharedSecret) {
    const expiresAt = Math.floor(now / 1000) + env.turnCredentialTtlSeconds;
    const username = `${expiresAt}:${userId}`;
    const credential = createHmac("sha1", env.turnSharedSecret).update(username).digest("base64");
    servers.push({ urls: env.turnUrls, username, credential });
  }
  return servers;
}
