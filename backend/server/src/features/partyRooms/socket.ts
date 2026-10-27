import { randomUUID } from "crypto";

import {
  PARTY_EVENTS,
  createPartyRoomSchema,
  partyRaiseHandEventSchema,
  partyReactEventSchema,
  partyRoomIdEventSchema,
  partySetMutedEventSchema,
  partySignalEventSchema,
  partyTargetEventSchema,
  type PartyEndedEvent,
  type PartyForceMuteEvent,
  type PartyHandDeclinedEvent,
  type PartyReactionEvent,
  type PartyRemovedEvent,
  type PartySignalRelayEvent,
} from "@sayly/shared";
import type { Server, Socket } from "socket.io";
import { ZodError } from "zod";

import { consumeLimit, rateLimitPolicies } from "../../infra/limiter/limiter";
import { AppError } from "../../shared/errors/AppError";
import { logger } from "../../shared/utils/logger";
import { getMessagingIo } from "../messaging/gateway";
import { ackOk, assertLiveSession, type AckFn, type AuthedSocket } from "../messaging/socket";

import { assertCanSignal } from "./policy";
import * as repository from "./repository";
import { createRoom, prepareJoin } from "./service";

/** A dropped connection keeps its seat this long, so a network blip doesn't hand the room over. */
export const PARTY_DISCONNECT_GRACE_MS = 15_000;
/** A room nobody joined (the host never connected) ends after this. */
const EMPTY_ROOM_TTL_MS = 2 * 60 * 1000;
const SWEEP_INTERVAL_MS = 15_000;

export function partyChannel(roomId: string) {
  return `party:${roomId}`;
}

/**
 * Errors go back through the ack only. The shared chat helper also emits `message_error`,
 * which an open chat screen would show as a failed message.
 */
function fail(ack: AckFn | undefined, error: unknown, fallback: string) {
  if (typeof ack !== "function") return;
  if (error instanceof ZodError) {
    ack({ ok: false, error: error.issues[0]?.message ?? "Invalid request", code: "VALIDATION_ERROR" });
    return;
  }
  const known = error instanceof AppError;
  ack({
    ok: false,
    error: known ? error.message : fallback,
    code: known ? error.code : "INTERNAL_ERROR",
    retryAfterMs: known && error.retryAfterSeconds ? error.retryAfterSeconds * 1000 : undefined,
  });
}

function warn(message: string, error: unknown) {
  logger.warn("party", message, { message: error instanceof Error ? error.message : "unknown" });
}

/**
 * Turns a committed change into socket traffic: notices to removed / force-muted sockets,
 * evictions from the room channel, then the new state (or the end notice) for everyone inside.
 */
export async function applyMutation(mutation: repository.PartyMutation | null) {
  const io = getMessagingIo();
  if (!io || !mutation) return;
  const channel = partyChannel(mutation.roomId);

  for (const socketId of mutation.removedSocketIds) {
    const removed: PartyRemovedEvent = { roomId: mutation.roomId };
    io.to(socketId).emit(PARTY_EVENTS.removed, removed);
  }
  if (mutation.forceMuteSocketId) {
    const forceMute: PartyForceMuteEvent = { roomId: mutation.roomId };
    io.to(mutation.forceMuteSocketId).emit(PARTY_EVENTS.forceMute, forceMute);
  }
  if (mutation.handDeclinedSocketId) {
    const declined: PartyHandDeclinedEvent = { roomId: mutation.roomId };
    io.to(mutation.handDeclinedSocketId).emit(PARTY_EVENTS.handDeclined, declined);
  }
  if (mutation.ended) {
    const ended: PartyEndedEvent = { roomId: mutation.roomId, reason: mutation.ended };
    io.to(channel).emit(PARTY_EVENTS.ended, ended);
  }
  for (const socketId of mutation.evictSocketIds) {
    io.in(socketId).socketsLeave(channel);
  }
  if (!mutation.ended) {
    const state = await repository.loadRoomDto(mutation.roomId);
    if (state) io.to(channel).emit(PARTY_EVENTS.state, state);
  }
}

/** Only the device that joined may signal or react for its member. */
async function requireSocketMember(roomId: string, userId: string, socketId: string) {
  const live = await repository.liveMembers(roomId);
  const self = live.rows.find((row) => row.userId === userId);
  if (!self || self.socketId !== socketId) {
    throw new AppError("You are not in this room on this device", 403, "FORBIDDEN");
  }
  return live;
}

async function leaveAfterGrace(socketId: string) {
  const rows = await repository.findParticipantsBySocket(socketId);
  for (const row of rows) {
    // Still on the old socket id means they did not come back on a new connection.
    await applyMutation(await repository.leaveRoom(row.roomId, row.userId, socketId));
  }
}

export function registerPartyRoomSockets(socket: Socket) {
  const userId = socket.data.userId as string | undefined;
  if (!userId) return;
  const authed = socket as AuthedSocket;

  /** Shared shape of the host/stage controls: validate, rate-limit, mutate, broadcast. */
  function control<T>(
    event: string,
    parse: (payload: unknown) => T,
    run: (body: T) => Promise<repository.PartyMutation>,
    fallback: string,
  ) {
    authed.on(event, async (payload: unknown, ack?: AckFn) => {
      try {
        const body = parse(payload);
        await consumeLimit(rateLimitPolicies.partyAction, userId!);
        await assertLiveSession(authed);
        await applyMutation(await run(body));
        ackOk(ack);
      } catch (error) {
        fail(ack, error, fallback);
      }
    });
  }

  // Same rules and rate limit as POST /party-rooms. The host then joins with `party_join`.
  authed.on(PARTY_EVENTS.create, async (payload: unknown, ack?: AckFn) => {
    try {
      const body = createPartyRoomSchema.parse(payload);
      await consumeLimit(rateLimitPolicies.groupCreate, userId);
      await assertLiveSession(authed, true);
      ackOk(ack, await createRoom(userId, body));
    } catch (error) {
      fail(ack, error, "Could not create the room");
    }
  });

  authed.on(PARTY_EVENTS.join, async (payload: unknown, ack?: AckFn) => {
    try {
      const { roomId } = partyRoomIdEventSchema.parse(payload);
      await consumeLimit(rateLimitPolicies.partyAction, userId);
      await assertLiveSession(authed, true);
      const { previousRoomId } = await prepareJoin(userId, roomId);
      if (previousRoomId) {
        await applyMutation(await repository.leaveRoom(previousRoomId, userId));
      }
      const joined = await repository.joinRoom(roomId, userId, authed.id);
      await authed.join(partyChannel(roomId));
      await applyMutation(joined);
      ackOk(ack, { room: await repository.loadRoomDto(roomId) });
    } catch (error) {
      fail(ack, error, "Could not join the room");
    }
  });

  // Leaving must always work: no rate limit or session recheck.
  authed.on(PARTY_EVENTS.leave, async (payload: unknown, ack?: AckFn) => {
    try {
      const { roomId } = partyRoomIdEventSchema.parse(payload);
      const left = await repository.leaveRoom(roomId, userId);
      await authed.leave(partyChannel(roomId));
      await applyMutation(left);
      ackOk(ack);
    } catch (error) {
      fail(ack, error, "Could not leave the room");
    }
  });

  control(
    PARTY_EVENTS.raiseHand,
    (payload) => partyRaiseHandEventSchema.parse(payload),
    (body) => repository.setHandRaised(body.roomId, userId, body.raised),
    "Could not raise your hand",
  );
  control(
    PARTY_EVENTS.promote,
    (payload) => partyTargetEventSchema.parse(payload),
    (body) => repository.promote(body.roomId, userId, body.userId),
    "Could not invite them on stage",
  );
  control(
    PARTY_EVENTS.declineHand,
    (payload) => partyTargetEventSchema.parse(payload),
    (body) => repository.declineHand(body.roomId, userId, body.userId),
    "Could not decline the request",
  );
  control(
    PARTY_EVENTS.demote,
    (payload) => partyTargetEventSchema.parse(payload),
    (body) => repository.demote(body.roomId, userId, body.userId),
    "Could not move them to the audience",
  );
  control(
    PARTY_EVENTS.remove,
    (payload) => partyTargetEventSchema.parse(payload),
    (body) => repository.removeParticipant(body.roomId, userId, body.userId),
    "Could not remove them",
  );
  control(
    PARTY_EVENTS.setMuted,
    (payload) => partySetMutedEventSchema.parse(payload),
    (body) => repository.setMuted(body.roomId, userId, body.muted),
    "Could not change your microphone",
  );
  control(
    PARTY_EVENTS.muteUser,
    (payload) => partyTargetEventSchema.parse(payload),
    (body) => repository.muteParticipant(body.roomId, userId, body.userId),
    "Could not mute them",
  );
  control(
    PARTY_EVENTS.end,
    (payload) => partyRoomIdEventSchema.parse(payload),
    (body) => repository.endRoom(body.roomId, userId),
    "Could not end the room",
  );

  authed.on(PARTY_EVENTS.react, async (payload: unknown, ack?: AckFn) => {
    try {
      const { roomId, kind } = partyReactEventSchema.parse(payload);
      await consumeLimit(rateLimitPolicies.partyReaction, userId);
      await requireSocketMember(roomId, userId, authed.id);
      const reaction: PartyReactionEvent = { roomId, userId, kind, id: randomUUID() };
      getMessagingIo()?.to(partyChannel(roomId)).emit(PARTY_EVENTS.reaction, reaction);
      ackOk(ack);
    } catch (error) {
      fail(ack, error, "Could not send the reaction");
    }
  });

  authed.on(PARTY_EVENTS.signal, async (payload: unknown, ack?: AckFn) => {
    try {
      const body = partySignalEventSchema.parse(payload);
      await consumeLimit(rateLimitPolicies.partySignal, userId);
      const live = await requireSocketMember(body.roomId, userId, authed.id);
      assertCanSignal(live.members, userId, body.toUserId);
      const target = live.rows.find((row) => row.userId === body.toUserId)!;
      const relay: PartySignalRelayEvent = { roomId: body.roomId, fromUserId: userId, key: body.key, data: body.data };
      getMessagingIo()?.to(target.socketId).emit(PARTY_EVENTS.signalRelay, relay);
      ackOk(ack);
    } catch (error) {
      fail(ack, error, "Could not send audio signal");
    }
  });

  authed.on("disconnect", () => {
    const socketId = authed.id;
    setTimeout(() => {
      void leaveAfterGrace(socketId).catch((error) => warn("disconnect cleanup failed", error));
    }, PARTY_DISCONNECT_GRACE_MS).unref();
  });
}

/**
 * Safety net for state the disconnect timers can't clean (a crashed or restarted server):
 * seats whose socket is gone for longer than the grace period are freed, and rooms nobody
 * ever joined are ended. Works across instances through the socket.io adapter.
 */
export function startPartyRoomSweeper(io: Server) {
  const missingSince = new Map<string, number>();

  const sweep = async () => {
    const now = Date.now();
    const seen = new Set<string>();
    for (const room of await repository.liveRoomsWithSockets()) {
      if (room.participants.length === 0) {
        if (now - room.createdAt.getTime() > EMPTY_ROOM_TTL_MS) {
          await applyMutation(await repository.endIfEmpty(room.id));
        }
        continue;
      }
      const connected = new Set((await io.in(partyChannel(room.id)).fetchSockets()).map((item) => item.id));
      for (const participant of room.participants) {
        if (connected.has(participant.socketId)) continue;
        seen.add(participant.socketId);
        const since = missingSince.get(participant.socketId) ?? now;
        missingSince.set(participant.socketId, since);
        if (now - since >= PARTY_DISCONNECT_GRACE_MS) {
          await applyMutation(await repository.leaveRoom(room.id, participant.userId, participant.socketId));
        }
      }
    }
    for (const socketId of missingSince.keys()) {
      if (!seen.has(socketId)) missingSince.delete(socketId);
    }
  };

  const timer = setInterval(() => {
    void sweep().catch((error) => warn("sweeper failed", error));
  }, SWEEP_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
