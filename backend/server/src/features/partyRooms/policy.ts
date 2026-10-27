import {
  PARTY_MAX_PARTICIPANTS,
  PARTY_MAX_SPEAKERS,
  PARTY_ROLES,
  partyRoleSpeaks,
  type PartyRole,
} from "@sayly/shared";

import { AppError } from "../../shared/errors/AppError";

/**
 * Party Room rules, free of I/O so they are unit-testable. The repository applies them while
 * holding the room row lock, so two hosts' taps can't both pass a capacity check.
 */

export type PartyMember = {
  userId: string;
  role: PartyRole;
  handRaisedAt: Date | null;
  joinedAt: Date;
};

export type RoomState = { status: string; hostId: string };

export function toRole(value: string): PartyRole {
  return (PARTY_ROLES as readonly string[]).includes(value) ? (value as PartyRole) : "LISTENER";
}

export function assertLive(room: RoomState | null): asserts room is RoomState {
  if (!room || room.status !== "LIVE") {
    throw new AppError("This room has ended", 404, "NOT_FOUND");
  }
}

/** The host always gets back in (a reconnect); everyone else needs a free seat. */
export function roleOnJoin(room: RoomState, userId: string, participantCount: number): PartyRole {
  if (room.hostId === userId) return "HOST";
  if (participantCount >= PARTY_MAX_PARTICIPANTS) {
    throw new AppError("This room is full", 409, "CONFLICT");
  }
  return "LISTENER";
}

export function requireMember(members: PartyMember[], userId: string): PartyMember {
  const member = members.find((item) => item.userId === userId);
  if (!member) {
    throw new AppError("You are not in this room", 403, "FORBIDDEN");
  }
  return member;
}

function requireTarget(members: PartyMember[], userId: string): PartyMember {
  const member = members.find((item) => item.userId === userId);
  if (!member) {
    throw new AppError("That person is no longer in the room", 404, "NOT_FOUND");
  }
  return member;
}

export function assertHost(actor: PartyMember) {
  if (actor.role !== "HOST") {
    throw new AppError("Only the host can do this", 403, "FORBIDDEN");
  }
}

export function speakerCount(members: PartyMember[]): number {
  return members.filter((member) => partyRoleSpeaks(member.role)).length;
}

/** Only listeners raise hands; speakers already have the floor. */
export function assertCanRaiseHand(actor: PartyMember) {
  if (actor.role !== "LISTENER") {
    throw new AppError("Only listeners can raise a hand", 409, "CONFLICT");
  }
}

/** The host invites a listener on stage, within the speaker cap. */
export function assertCanPromote(actor: PartyMember, members: PartyMember[], targetId: string): PartyMember {
  assertHost(actor);
  const target = requireTarget(members, targetId);
  if (target.role !== "LISTENER") {
    throw new AppError("They are already on stage", 409, "CONFLICT");
  }
  if (speakerCount(members) >= PARTY_MAX_SPEAKERS) {
    throw new AppError(`A room can have at most ${PARTY_MAX_SPEAKERS} speakers`, 409, "CONFLICT");
  }
  return target;
}

/** The host turns down a listener whose hand is up. */
export function assertCanDeclineHand(actor: PartyMember, members: PartyMember[], targetId: string): PartyMember {
  assertHost(actor);
  const target = requireTarget(members, targetId);
  if (target.role !== "LISTENER" || !target.handRaisedAt) {
    throw new AppError("Their hand is not raised", 409, "CONFLICT");
  }
  return target;
}

/** The host moves a speaker to the audience; a speaker may also step down on their own. */
export function assertCanDemote(actor: PartyMember, members: PartyMember[], targetId: string): PartyMember {
  const target = requireTarget(members, targetId);
  if (target.role !== "SPEAKER") {
    throw new AppError(target.role === "HOST" ? "The host stays on stage" : "They are not a speaker", 409, "CONFLICT");
  }
  if (actor.userId !== target.userId) {
    assertHost(actor);
  }
  return target;
}

export function assertCanRemove(actor: PartyMember, members: PartyMember[], targetId: string): PartyMember {
  assertHost(actor);
  if (actor.userId === targetId) {
    throw new AppError("Use leave or end the room instead", 400, "VALIDATION_ERROR");
  }
  return requireTarget(members, targetId);
}

/** The host can silence a speaker (they unmute themselves later), never unmute anyone. */
export function assertCanMuteOther(actor: PartyMember, members: PartyMember[], targetId: string): PartyMember {
  assertHost(actor);
  const target = requireTarget(members, targetId);
  if (!partyRoleSpeaks(target.role)) {
    throw new AppError("Only speakers have a microphone", 409, "CONFLICT");
  }
  return target;
}

/** Audio only flows between a pair if at least one of them speaks. */
export function assertCanSignal(members: PartyMember[], fromId: string, toId: string) {
  const from = requireMember(members, fromId);
  const to = requireTarget(members, toId);
  if (fromId === toId || (!partyRoleSpeaks(from.role) && !partyRoleSpeaks(to.role))) {
    throw new AppError("No audio link between these participants", 409, "CONFLICT");
  }
}

/** When the host leaves, the longest-standing speaker takes over; with no speaker the room ends. */
export function nextHost(members: PartyMember[], leavingId: string): PartyMember | null {
  const candidates = members
    .filter((member) => member.userId !== leavingId && member.role === "SPEAKER")
    .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
  return candidates[0] ?? null;
}
