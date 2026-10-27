import {
  partyRoleSpeaks,
  type PartyParticipantDto,
  type PartyReaction,
  type PartyReactionEvent,
  type PartyRoomDto,
} from "@sayly/shared";

/**
 * One audio link the app should keep open. Audio is a mesh: every speaker sends to every
 * other participant, so a pair needs a link when at least one of the two speaks.
 */
export type PeerPlan = {
  peerId: string;
  /** Same on both ends; changes when either side starts or stops sending. */
  key: string;
  iSend: boolean;
  theySend: boolean;
  /** Exactly one side creates the offer: the only sender, or the smaller id when both send. */
  iOffer: boolean;
};

function allParticipants(room: PartyRoomDto): PartyParticipantDto[] {
  return [...room.speakers, ...room.listeners];
}

export function findParticipant(room: PartyRoomDto | null, userId: string | null) {
  if (!room || !userId) return null;
  return allParticipants(room).find((participant) => participant.id === userId) ?? null;
}

function peerKey(selfId: string, selfSends: boolean, peerId: string, peerSends: boolean) {
  const [first, second] =
    selfId < peerId
      ? [`${selfId}:${selfSends ? 1 : 0}`, `${peerId}:${peerSends ? 1 : 0}`]
      : [`${peerId}:${peerSends ? 1 : 0}`, `${selfId}:${selfSends ? 1 : 0}`];
  return `${first}|${second}`;
}

/** The links this participant must hold for the current room state, keyed by peer id. */
export function planPeers(selfId: string, room: PartyRoomDto): Map<string, PeerPlan> {
  const plans = new Map<string, PeerPlan>();
  const self = findParticipant(room, selfId);
  if (!self) return plans;
  const iSend = partyRoleSpeaks(self.role);

  for (const peer of allParticipants(room)) {
    if (peer.id === selfId) continue;
    const theySend = partyRoleSpeaks(peer.role);
    if (!iSend && !theySend) continue;
    const iOffer = iSend && theySend ? selfId < peer.id : iSend;
    plans.set(peer.id, {
      peerId: peer.id,
      key: peerKey(selfId, iSend, peer.id, theySend),
      iSend,
      theySend,
      iOffer,
    });
  }
  return plans;
}

export type FloatingReaction = {
  id: string;
  kind: PartyReaction;
  /** 0..1 horizontal lane, so simultaneous reactions don't stack. */
  lane: number;
  at: number;
};

/** How long a reaction floats on screen. */
export const REACTION_LIFETIME_MS = 2_600;
/** Older reactions are dropped beyond this many, so a burst can't flood the screen. */
export const MAX_FLOATING_REACTIONS = 24;

function laneFor(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return (hash % 100) / 100;
}

export function addReaction(
  list: FloatingReaction[],
  event: Pick<PartyReactionEvent, "id" | "kind">,
  now: number,
): FloatingReaction[] {
  if (list.some((item) => item.id === event.id)) return list;
  const alive = list.filter((item) => now - item.at < REACTION_LIFETIME_MS);
  return [...alive, { id: event.id, kind: event.kind, lane: laneFor(event.id), at: now }].slice(
    -MAX_FLOATING_REACTIONS,
  );
}

export function raisedHands(room: PartyRoomDto): PartyParticipantDto[] {
  return room.listeners.filter((listener) => listener.handRaisedAt !== null);
}
