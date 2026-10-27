import {
  PARTY_EVENTS,
  type PartyEndReason,
  type PartyEndedEvent,
  type PartyForceMuteEvent,
  type PartyHandDeclinedEvent,
  type PartyReaction,
  type PartyReactionEvent,
  type PartyRemovedEvent,
  type PartyRoomDto,
} from "@sayly/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/features/auth";
import { useSocketContext } from "@/features/chat/socket/SocketProvider";
import { isApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/queryKeys";

import {
  REACTION_LIFETIME_MS,
  addReaction,
  findParticipant,
  type FloatingReaction,
} from "../model/partyModel";
import { usePartyAudio } from "./usePartyAudio";

export type PartyPhase =
  | { kind: "joining" }
  | { kind: "live" }
  | { kind: "ended"; reason: PartyEndReason | "removed" | "left" }
  | { kind: "error"; message: string };

function errorMessage(error: unknown) {
  if (isApiError(error)) return error.message;
  return error instanceof Error ? error.message : "Could not join the room.";
}

/**
 * One Party Room session, tied to the screen: joins on mount (and again after a socket
 * reconnect, which keeps the seat), follows `party_state`, leaves on unmount, and runs the
 * audio mesh. Every control is a socket event; the server answers with a fresh state.
 */
export function usePartyRoom(roomId: string) {
  const { userId } = useAuth();
  const { socket, emit, isConnected } = useSocketContext();
  const queryClient = useQueryClient();
  const [room, setRoom] = useState<PartyRoomDto | null>(null);
  const [phase, setPhase] = useState<PartyPhase>({ kind: "joining" });
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const self = findParticipant(room, userId);
  const muted = self?.muted ?? true;

  // Join now and after every reconnect while the room is still on.
  useEffect(() => {
    if (!isConnected) return;
    if (phaseRef.current.kind === "ended") return;
    let cancelled = false;
    emit<{ room: PartyRoomDto | null }>(PARTY_EVENTS.join, { roomId })
      .then(({ room: joined }) => {
        if (cancelled) return;
        if (!joined) {
          setPhase({ kind: "ended", reason: "empty" });
          return;
        }
        setRoom(joined);
        setPhase({ kind: "live" });
      })
      .catch((error: unknown) => {
        if (!cancelled) setPhase({ kind: "error", message: errorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [roomId, emit, isConnected]);

  // Leave when the screen goes away.
  useEffect(
    () => () => {
      if (phaseRef.current.kind === "live") {
        emit(PARTY_EVENTS.leave, { roomId }).catch(() => undefined);
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.partyRooms.all });
    },
    [roomId, emit, queryClient],
  );

  useEffect(() => {
    if (!socket) return;
    const onState = (state: PartyRoomDto) => {
      if (state.id === roomId) setRoom(state);
    };
    const onEnded = (event: PartyEndedEvent) => {
      if (event.roomId !== roomId) return;
      setPhase({ kind: "ended", reason: event.reason });
    };
    const onRemoved = (event: PartyRemovedEvent) => {
      if (event.roomId !== roomId) return;
      setPhase({ kind: "ended", reason: "removed" });
    };
    const onReaction = (event: PartyReactionEvent) => {
      if (event.roomId !== roomId) return;
      setReactions((list) => addReaction(list, event, Date.now()));
    };
    // The server already marked us muted; the state broadcast switches the track off.
    const onForceMute = (event: PartyForceMuteEvent) => {
      if (event.roomId === roomId) setNotice("The host muted your microphone");
    };
    const onHandDeclined = (event: PartyHandDeclinedEvent) => {
      if (event.roomId === roomId) setNotice("The host can't bring you on stage right now");
    };

    socket.on(PARTY_EVENTS.state, onState);
    socket.on(PARTY_EVENTS.ended, onEnded);
    socket.on(PARTY_EVENTS.removed, onRemoved);
    socket.on(PARTY_EVENTS.reaction, onReaction);
    socket.on(PARTY_EVENTS.forceMute, onForceMute);
    socket.on(PARTY_EVENTS.handDeclined, onHandDeclined);
    return () => {
      socket.off(PARTY_EVENTS.state, onState);
      socket.off(PARTY_EVENTS.ended, onEnded);
      socket.off(PARTY_EVENTS.removed, onRemoved);
      socket.off(PARTY_EVENTS.reaction, onReaction);
      socket.off(PARTY_EVENTS.forceMute, onForceMute);
      socket.off(PARTY_EVENTS.handDeclined, onHandDeclined);
    };
  }, [socket, roomId]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3_000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Floating reactions clear themselves.
  useEffect(() => {
    if (reactions.length === 0) return;
    const timer = setTimeout(() => {
      const now = Date.now();
      setReactions((list) => list.filter((item) => now - item.at < REACTION_LIFETIME_MS));
    }, REACTION_LIFETIME_MS);
    return () => clearTimeout(timer);
  }, [reactions]);

  const live = phase.kind === "live";
  const audio = usePartyAudio({
    room: live ? room : null,
    selfId: userId,
    socket,
    emit,
    muted,
  });

  const send = useCallback(
    (event: string, extra: Record<string, unknown> = {}) => emit(event, { roomId, ...extra }),
    [emit, roomId],
  );

  const actions = useMemo(
    () => ({
      raiseHand: (raised: boolean) => send(PARTY_EVENTS.raiseHand, { raised }),
      promote: (targetId: string) => send(PARTY_EVENTS.promote, { userId: targetId }),
      declineHand: (targetId: string) => send(PARTY_EVENTS.declineHand, { userId: targetId }),
      demote: (targetId: string) => send(PARTY_EVENTS.demote, { userId: targetId }),
      remove: (targetId: string) => send(PARTY_EVENTS.remove, { userId: targetId }),
      muteUser: (targetId: string) => send(PARTY_EVENTS.muteUser, { userId: targetId }),
      setMuted: (value: boolean) => send(PARTY_EVENTS.setMuted, { muted: value }),
      react: (kind: PartyReaction) => send(PARTY_EVENTS.react, { kind }),
      end: () => send(PARTY_EVENTS.end),
      leave: async () => {
        setPhase({ kind: "ended", reason: "left" });
        await send(PARTY_EVENTS.leave).catch(() => undefined);
      },
    }),
    [send],
  );

  return { room, phase, self, isHost: self?.role === "HOST", reactions, notice, audio, actions };
}
