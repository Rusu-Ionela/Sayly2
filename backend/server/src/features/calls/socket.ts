import { eq } from "drizzle-orm";
import type { Socket } from "socket.io";

import { db } from "../../db/client";
import { profiles } from "../../db/schema";
import { consumeLimit, rateLimitPolicies } from "../../infra/limiter/limiter";
import { AppError } from "../../shared/errors/AppError";
import { logger } from "../../shared/utils/logger";
import { resignMediaUrl } from "../media/storage";
import { emitToUsers } from "../messaging/gateway";
import { isOnline } from "../messaging/presence";
import {
  ackOk,
  assertLiveSession,
  fail,
  type AckFn,
  type AuthedSocket,
} from "../messaging/socket";

import { callIdSchema, callInviteSchema, callSignalSchema } from "./schema";
import {
  acceptCall,
  currentCallId,
  endCall,
  getCallForParticipant,
  otherParty,
  startCall,
  type EndReason,
} from "./service";

async function callerSummary(userId: string) {
  const [row] = await db
    .select({ displayName: profiles.displayName, avatar: profiles.profileImageUrl })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  return { id: userId, displayName: row?.displayName ?? "Someone", avatarUrl: resignMediaUrl(row?.avatar) };
}

/** Signalling for 1:1 audio/video calls. Media never touches the server. */
export function registerCallSockets(socket: Socket) {
  const userId = socket.data.userId as string | undefined;
  if (!userId) {
    return;
  }
  const authed = socket as AuthedSocket;

  authed.on("call_invite", async (payload: unknown, ack?: AckFn) => {
    try {
      const body = callInviteSchema.parse(payload);
      await consumeLimit(rateLimitPolicies.callInvite, userId);
      await assertLiveSession(authed, true);
      const call = await startCall({ callerId: userId, ...body });
      emitToUsers([call.calleeId], "call_incoming", {
        callId: call.callId,
        conversationId: call.conversationId,
        kind: call.kind,
        caller: await callerSummary(userId),
      });
      ackOk(ack, { callId: call.callId });
    } catch (error) {
      fail(authed, ack, error, "Could not start the call");
    }
  });

  authed.on("call_accept", async (payload: unknown, ack?: AckFn) => {
    try {
      const body = callIdSchema.parse(payload);
      await assertLiveSession(authed);
      const call = await acceptCall(body.callId, userId);
      emitToUsers([call.callerId], "call_accepted", { callId: call.callId });
      ackOk(ack);
    } catch (error) {
      fail(authed, ack, error, "Could not answer the call");
    }
  });

  authed.on("call_end", async (payload: unknown, ack?: AckFn) => {
    try {
      const body = callIdSchema.parse(payload);
      // No session recheck or rate limit: hanging up must always work.
      const { record, reason } = await endCall(body.callId, userId);
      emitToUsers([otherParty(record, userId)], "call_ended", { callId: record.callId, reason });
      ackOk(ack);
    } catch (error) {
      fail(authed, ack, error, "Could not end the call");
    }
  });

  authed.on("call_signal", async (payload: unknown, ack?: AckFn) => {
    try {
      const body = callSignalSchema.parse(payload);
      await consumeLimit(rateLimitPolicies.callSignal, userId);
      const call = await getCallForParticipant(body.callId, userId);
      emitToUsers([otherParty(call, userId)], "call_signal", { callId: call.callId, data: body.data });
      ackOk(ack);
    } catch (error) {
      fail(authed, ack, error, "Could not send call signal");
    }
  });

  // Closing the app or losing the connection must free the other person.
  authed.on("disconnect", () => {
    void (async () => {
      try {
        if (await isOnline(userId)) {
          return; // another device/socket of this user is still connected
        }
        const callId = await currentCallId(userId);
        if (!callId) {
          return;
        }
        const reason: EndReason = "disconnected";
        const { record } = await endCall(callId, userId, reason);
        emitToUsers([otherParty(record, userId)], "call_ended", { callId: record.callId, reason });
      } catch (error) {
        if (!(error instanceof AppError && error.code === "NOT_FOUND")) {
          logger.warn("calls", "disconnect cleanup failed", {
            message: error instanceof Error ? error.message : "unknown",
          });
        }
      }
    })();
  });
}
