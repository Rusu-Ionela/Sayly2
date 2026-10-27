import {
  CALL_EVENTS,
  type CallAcceptedEvent,
  type CallEndedEvent,
  type CallIncomingEvent,
  type CallSignalEvent,
} from "@sayly/shared";
import { eq } from "drizzle-orm";
import type { Socket } from "socket.io";

import { db } from "../../db/client";
import { profiles } from "../../db/schema";
import { consumeLimit, rateLimitPolicies } from "../../infra/limiter/limiter";
import { AppError } from "../../shared/errors/AppError";
import { logger } from "../../shared/utils/logger";
import { resignMediaUrl } from "../media/storage";
import { emitToUserExceptSocket, emitToUsers } from "../messaging/gateway";
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
  declineCall,
  endCall,
  getCallForParticipant,
  otherParty,
  startCall,
  type EndReason,
} from "./service";

async function callerSummary(userId: string): Promise<CallIncomingEvent["caller"]> {
  const [row] = await db
    .select({ displayName: profiles.displayName, avatar: profiles.profileImageUrl })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  return { id: userId, displayName: row?.displayName ?? "Someone", avatarUrl: resignMediaUrl(row?.avatar) };
}

function notifyEnded(userId: string, payload: CallEndedEvent) {
  emitToUsers([userId], CALL_EVENTS.ended, payload);
}

/** Signalling for 1:1 audio/video calls. Media never touches the server. */
export function registerCallSockets(socket: Socket) {
  const userId = socket.data.userId as string | undefined;
  if (!userId) {
    return;
  }
  const authed = socket as AuthedSocket;

  authed.on(CALL_EVENTS.invite, async (payload: unknown, ack?: AckFn) => {
    try {
      const body = callInviteSchema.parse(payload);
      await consumeLimit(rateLimitPolicies.callInvite, userId);
      await assertLiveSession(authed, true);
      const call = await startCall({ callerId: userId, ...body });
      const incoming: CallIncomingEvent = {
        callId: call.callId,
        conversationId: call.conversationId,
        kind: call.kind,
        caller: await callerSummary(userId),
      };
      emitToUsers([call.calleeId], CALL_EVENTS.incoming, incoming);
      ackOk(ack, { callId: call.callId });
    } catch (error) {
      fail(authed, ack, error, "Could not start the call");
    }
  });

  authed.on(CALL_EVENTS.accept, async (payload: unknown, ack?: AckFn) => {
    try {
      const body = callIdSchema.parse(payload);
      await assertLiveSession(authed);
      const call = await acceptCall(body.callId, userId);
      const accepted: CallAcceptedEvent = { callId: call.callId };
      emitToUsers([call.callerId], CALL_EVENTS.accepted, accepted);
      // The callee's other phones/tablets stop ringing.
      const elsewhere: CallEndedEvent = { callId: call.callId, reason: "answered_elsewhere" };
      emitToUserExceptSocket(userId, authed.id, CALL_EVENTS.ended, elsewhere);
      ackOk(ack);
    } catch (error) {
      fail(authed, ack, error, "Could not answer the call");
    }
  });

  authed.on(CALL_EVENTS.decline, async (payload: unknown, ack?: AckFn) => {
    try {
      const body = callIdSchema.parse(payload);
      const call = await declineCall(body.callId, userId);
      const ended: CallEndedEvent = { callId: call.callId, reason: "declined" };
      notifyEnded(call.callerId, ended);
      // Also stops the ring on the callee's other devices.
      emitToUserExceptSocket(userId, authed.id, CALL_EVENTS.ended, ended);
      ackOk(ack);
    } catch (error) {
      fail(authed, ack, error, "Could not decline the call");
    }
  });

  authed.on(CALL_EVENTS.end, async (payload: unknown, ack?: AckFn) => {
    try {
      const body = callIdSchema.parse(payload);
      // No session recheck or rate limit: hanging up must always work.
      const { record, reason } = await endCall(body.callId, userId);
      notifyEnded(otherParty(record, userId), { callId: record.callId, reason });
      if (reason === "declined") {
        emitToUserExceptSocket(userId, authed.id, CALL_EVENTS.ended, { callId: record.callId, reason });
      }
      ackOk(ack);
    } catch (error) {
      fail(authed, ack, error, "Could not end the call");
    }
  });

  authed.on(CALL_EVENTS.signal, async (payload: unknown, ack?: AckFn) => {
    try {
      const body = callSignalSchema.parse(payload);
      await consumeLimit(rateLimitPolicies.callSignal, userId);
      const call = await getCallForParticipant(body.callId, userId);
      const signal: CallSignalEvent = { callId: call.callId, data: body.data };
      emitToUsers([otherParty(call, userId)], CALL_EVENTS.signal, signal);
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
        notifyEnded(otherParty(record, userId), { callId: record.callId, reason });
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
