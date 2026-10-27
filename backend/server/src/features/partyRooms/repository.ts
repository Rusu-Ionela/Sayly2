import { and, asc, count, desc, eq, inArray, isNull, type SQL } from "drizzle-orm";
import {
  PARTY_MAX_PARTICIPANTS,
  PARTY_MAX_SPEAKERS,
  partyRoleSpeaks,
  type PartyEndReason,
  type PartyParticipantDto,
  type PartyPersonDto,
  type PartyRoomDto,
  type PartyRoomSummaryDto,
} from "@sayly/shared";

import { db, type DbTransaction } from "../../db/client";
import { isUniqueViolation } from "../../db/errors";
import { lockUser } from "../../db/helpers";
import {
  groups,
  languages,
  partyRoomParticipants,
  partyRooms,
  profiles,
  type PartyRoom,
  type PartyRoomParticipant,
} from "../../db/schema";
import { AppError } from "../../shared/errors/AppError";
import { resignMediaUrl } from "../media/storage";

import * as policy from "./policy";

type Executor = typeof db | DbTransaction;

/** What the socket layer must do after a mutation commits. */
export type PartyMutation = {
  roomId: string;
  /** Set when the mutation ended the room. */
  ended: PartyEndReason | null;
  /** Sockets that must leave the room's socket.io channel (left, removed, replaced, ended). */
  evictSocketIds: string[];
  /** Sockets told they were removed by the host (or replaced by the same member's other device). */
  removedSocketIds: string[];
  /** Socket told to switch its microphone off. */
  forceMuteSocketId: string | null;
  /** Socket told the host turned down its raised hand. */
  handDeclinedSocketId: string | null;
};

function mutation(roomId: string, patch: Partial<Omit<PartyMutation, "roomId">> = {}): PartyMutation {
  return {
    roomId,
    ended: null,
    evictSocketIds: [],
    removedSocketIds: [],
    forceMuteSocketId: null,
    handDeclinedSocketId: null,
    ...patch,
  };
}

function toMember(row: PartyRoomParticipant): policy.PartyMember {
  return { userId: row.userId, role: policy.toRole(row.role), handRaisedAt: row.handRaisedAt, joinedAt: row.joinedAt };
}

async function lockRoom(tx: DbTransaction, roomId: string): Promise<PartyRoom | null> {
  const [row] = await tx.select().from(partyRooms).where(eq(partyRooms.id, roomId)).for("update").limit(1);
  return row ?? null;
}

async function participantRows(executor: Executor, roomId: string): Promise<PartyRoomParticipant[]> {
  return executor.select().from(partyRoomParticipants).where(eq(partyRoomParticipants.roomId, roomId));
}

/**
 * Runs `fn` with the room row locked and its participants loaded, so every rule check sees
 * the state it changes. Rejects ended rooms.
 */
async function withLiveRoom<T>(
  roomId: string,
  fn: (tx: DbTransaction, room: PartyRoom, rows: PartyRoomParticipant[]) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const room = await lockRoom(tx, roomId);
    policy.assertLive(room);
    return fn(tx, room!, await participantRows(tx, roomId));
  });
}

async function updateParticipant(
  tx: DbTransaction,
  roomId: string,
  userId: string,
  patch: Partial<Pick<PartyRoomParticipant, "role" | "muted" | "handRaisedAt" | "socketId">>,
) {
  await tx
    .update(partyRoomParticipants)
    .set(patch)
    .where(and(eq(partyRoomParticipants.roomId, roomId), eq(partyRoomParticipants.userId, userId)));
}

/** Marks the room ended and empties it; returns the sockets that were still inside. */
async function endRoomTx(tx: DbTransaction, roomId: string, rows: PartyRoomParticipant[], reason: PartyEndReason) {
  await tx.update(partyRooms).set({ status: "ENDED", endedAt: new Date() }).where(eq(partyRooms.id, roomId));
  await tx.delete(partyRoomParticipants).where(eq(partyRoomParticipants.roomId, roomId));
  return mutation(roomId, { ended: reason, evictSocketIds: rows.map((row) => row.socketId) });
}

// ---- reads ----

export async function findRoom(roomId: string): Promise<PartyRoom | null> {
  const [row] = await db.select().from(partyRooms).where(eq(partyRooms.id, roomId)).limit(1);
  return row ?? null;
}

export async function findParticipation(userId: string): Promise<PartyRoomParticipant | null> {
  const [row] = await db.select().from(partyRoomParticipants).where(eq(partyRoomParticipants.userId, userId)).limit(1);
  return row ?? null;
}

export async function isInPartyRoom(userId: string): Promise<boolean> {
  return (await findParticipation(userId)) !== null;
}

export async function findParticipantsBySocket(socketId: string): Promise<PartyRoomParticipant[]> {
  return db.select().from(partyRoomParticipants).where(eq(partyRoomParticipants.socketId, socketId));
}

/** Participants of a live room, for checks outside a transaction (reactions, signalling). */
export async function liveMembers(roomId: string): Promise<{ members: policy.PartyMember[]; rows: PartyRoomParticipant[] }> {
  const room = await findRoom(roomId);
  policy.assertLive(room);
  const rows = await participantRows(db, roomId);
  return { members: rows.map(toMember), rows };
}

async function loadPeople(userIds: string[]): Promise<Map<string, PartyPersonDto>> {
  const ids = [...new Set(userIds)];
  const people = new Map<string, PartyPersonDto>();
  if (ids.length > 0) {
    const rows = await db
      .select({ id: profiles.userId, displayName: profiles.displayName, avatar: profiles.profileImageUrl })
      .from(profiles)
      .where(inArray(profiles.userId, ids));
    for (const row of rows) {
      people.set(row.id, {
        id: row.id,
        displayName: row.displayName || "Sayly member",
        avatarUrl: row.avatar ? (resignMediaUrl(row.avatar) ?? row.avatar) : null,
      });
    }
  }
  for (const id of ids) {
    if (!people.has(id)) people.set(id, { id, displayName: "Sayly member", avatarUrl: null });
  }
  return people;
}

const roomColumns = {
  room: partyRooms,
  languageName: languages.name,
  flagEmoji: languages.flagEmoji,
};

/** Full live state of a room, or null once it ended. */
export async function loadRoomDto(roomId: string): Promise<PartyRoomDto | null> {
  const [row] = await db
    .select(roomColumns)
    .from(partyRooms)
    .innerJoin(languages, eq(languages.id, partyRooms.languageId))
    .where(and(eq(partyRooms.id, roomId), eq(partyRooms.status, "LIVE")))
    .limit(1);
  if (!row) return null;

  const rows = await participantRows(db, roomId);
  const people = await loadPeople(rows.map((item) => item.userId));
  const participants: PartyParticipantDto[] = rows.map((item) => ({
    ...people.get(item.userId)!,
    role: policy.toRole(item.role),
    muted: item.muted,
    handRaisedAt: item.handRaisedAt?.toISOString() ?? null,
    joinedAt: item.joinedAt.toISOString(),
  }));
  const byJoin = (a: PartyParticipantDto, b: PartyParticipantDto) => a.joinedAt.localeCompare(b.joinedAt);

  return {
    id: row.room.id,
    title: row.room.title,
    languageId: row.room.languageId,
    languageName: row.languageName,
    flagEmoji: row.flagEmoji || null,
    groupId: row.room.groupId,
    status: "LIVE",
    hostId: row.room.hostId,
    speakers: participants
      .filter((item) => partyRoleSpeaks(item.role))
      .sort((a, b) => (a.role === "HOST" ? -1 : b.role === "HOST" ? 1 : byJoin(a, b))),
    listeners: participants
      .filter((item) => item.role === "LISTENER")
      .sort((a, b) => {
        if (a.handRaisedAt && b.handRaisedAt) return a.handRaisedAt.localeCompare(b.handRaisedAt);
        if (a.handRaisedAt) return -1;
        if (b.handRaisedAt) return 1;
        return byJoin(a, b);
      }),
    maxSpeakers: PARTY_MAX_SPEAKERS,
    maxParticipants: PARTY_MAX_PARTICIPANTS,
    createdAt: row.room.createdAt.toISOString(),
  };
}

/**
 * Live rooms for the lobby, newest first. Rooms of deleted groups are hidden; group rooms are
 * shown only for `visibleGroupIds` (the viewer's groups), open rooms to everyone.
 */
export async function listLiveRooms(filter: {
  languageId?: string;
  groupId?: string;
  visibleGroupIds: string[];
}): Promise<PartyRoomSummaryDto[]> {
  const conditions: (SQL | undefined)[] = [eq(partyRooms.status, "LIVE"), isNull(groups.deletedAt)];
  if (filter.languageId) conditions.push(eq(partyRooms.languageId, filter.languageId));
  if (filter.groupId) {
    conditions.push(eq(partyRooms.groupId, filter.groupId));
  } else {
    conditions.push(isNull(partyRooms.groupId));
  }

  const rows = await db
    .select(roomColumns)
    .from(partyRooms)
    .innerJoin(languages, eq(languages.id, partyRooms.languageId))
    .leftJoin(groups, eq(groups.id, partyRooms.groupId))
    .where(and(...conditions))
    .orderBy(desc(partyRooms.createdAt))
    .limit(50);
  const visible = rows.filter((row) => !row.room.groupId || filter.visibleGroupIds.includes(row.room.groupId));
  if (visible.length === 0) return [];

  const roomIds = visible.map((row) => row.room.id);
  const [counts, speakerRows] = await Promise.all([
    db
      .select({ roomId: partyRoomParticipants.roomId, value: count() })
      .from(partyRoomParticipants)
      .where(inArray(partyRoomParticipants.roomId, roomIds))
      .groupBy(partyRoomParticipants.roomId),
    db
      .select({ roomId: partyRoomParticipants.roomId, userId: partyRoomParticipants.userId })
      .from(partyRoomParticipants)
      .where(and(inArray(partyRoomParticipants.roomId, roomIds), inArray(partyRoomParticipants.role, ["HOST", "SPEAKER"])))
      .orderBy(asc(partyRoomParticipants.joinedAt)),
  ]);
  const countByRoom = new Map(counts.map((row) => [row.roomId, Number(row.value)]));
  const people = await loadPeople([...visible.map((row) => row.room.hostId), ...speakerRows.map((row) => row.userId)]);

  return visible
    // A room nobody joined yet (the host is still connecting) is not worth listing.
    .filter((row) => (countByRoom.get(row.room.id) ?? 0) > 0)
    .map((row) => ({
      id: row.room.id,
      title: row.room.title,
      languageId: row.room.languageId,
      languageName: row.languageName,
      flagEmoji: row.flagEmoji || null,
      groupId: row.room.groupId,
      host: people.get(row.room.hostId)!,
      speakers: speakerRows
        .filter((item) => item.roomId === row.room.id && item.userId !== row.room.hostId)
        .slice(0, 4)
        .map((item) => people.get(item.userId)!),
      participantCount: countByRoom.get(row.room.id) ?? 0,
      createdAt: row.room.createdAt.toISOString(),
    }));
}

/** Live rooms and their participants' sockets, for the stale-socket sweeper. */
export async function liveRoomsWithSockets() {
  const rooms = await db
    .select({ id: partyRooms.id, createdAt: partyRooms.createdAt })
    .from(partyRooms)
    .where(eq(partyRooms.status, "LIVE"));
  if (rooms.length === 0) return [];
  const rows = await db
    .select()
    .from(partyRoomParticipants)
    .where(inArray(partyRoomParticipants.roomId, rooms.map((room) => room.id)));
  return rooms.map((room) => ({ ...room, participants: rows.filter((row) => row.roomId === room.id) }));
}

// ---- mutations ----

export async function createRoom(input: {
  hostId: string;
  title: string;
  languageId: string;
  groupId: string | null;
}): Promise<PartyRoom> {
  return db.transaction(async (tx) => {
    await lockUser(tx, input.hostId);
    const [hosting] = await tx
      .select({ id: partyRooms.id })
      .from(partyRooms)
      .where(and(eq(partyRooms.hostId, input.hostId), eq(partyRooms.status, "LIVE")))
      .limit(1);
    if (hosting) {
      throw new AppError("You are already hosting a live room", 409, "CONFLICT", { roomId: hosting.id });
    }
    const [room] = await tx.insert(partyRooms).values(input).returning();
    if (!room) throw new Error("Database did not return party room");
    return room;
  });
}

/**
 * Puts the member in the room on this socket. A member already inside (reconnect, or another
 * device) keeps their role; the previous socket is told it was replaced.
 */
export async function joinRoom(roomId: string, userId: string, socketId: string): Promise<PartyMutation> {
  try {
    return await withLiveRoom(roomId, async (tx, room, rows) => {
      const existing = rows.find((row) => row.userId === userId);
      if (existing) {
        if (existing.socketId === socketId) return mutation(roomId);
        await updateParticipant(tx, roomId, userId, { socketId });
        return mutation(roomId, { evictSocketIds: [existing.socketId], removedSocketIds: [existing.socketId] });
      }
      const role = policy.roleOnJoin(room, userId, rows.length);
      await tx.insert(partyRoomParticipants).values({ roomId, userId, role, muted: true, socketId });
      return mutation(roomId);
    });
  } catch (error) {
    // The one-room-per-member index: they joined another room at the same moment.
    if (isUniqueViolation(error)) {
      throw new AppError("You are already in another room", 409, "CONFLICT");
    }
    throw error;
  }
}

/**
 * Takes the member out. When `onlySocketId` is given (a dropped connection), a member who has
 * since rejoined on another socket stays. A leaving host hands over to the longest-standing
 * speaker; without one, or when the room is empty, the room ends.
 */
export async function leaveRoom(roomId: string, userId: string, onlySocketId?: string): Promise<PartyMutation | null> {
  return db.transaction(async (tx) => {
    const room = await lockRoom(tx, roomId);
    if (!room || room.status !== "LIVE") return null;
    const rows = await participantRows(tx, roomId);
    const leaving = rows.find((row) => row.userId === userId);
    if (!leaving || (onlySocketId && leaving.socketId !== onlySocketId)) return null;

    const remaining = rows.filter((row) => row.userId !== userId);
    if (remaining.length === 0) {
      return endRoomTx(tx, roomId, rows, "empty");
    }
    if (room.hostId === userId) {
      const successor = policy.nextHost(rows.map(toMember), userId);
      if (!successor) {
        return endRoomTx(tx, roomId, rows, "host_left");
      }
      await tx.update(partyRooms).set({ hostId: successor.userId }).where(eq(partyRooms.id, roomId));
      await updateParticipant(tx, roomId, successor.userId, { role: "HOST" });
    }
    await tx
      .delete(partyRoomParticipants)
      .where(and(eq(partyRoomParticipants.roomId, roomId), eq(partyRoomParticipants.userId, userId)));
    return mutation(roomId, { evictSocketIds: [leaving.socketId] });
  });
}

export async function endRoom(roomId: string, actorId: string): Promise<PartyMutation> {
  return withLiveRoom(roomId, async (tx, _room, rows) => {
    policy.assertHost(policy.requireMember(rows.map(toMember), actorId));
    return endRoomTx(tx, roomId, rows, "host_ended");
  });
}

/** Ends a live room nobody is in any more (crash, or a host who never connected). */
export async function endIfEmpty(roomId: string): Promise<PartyMutation | null> {
  return db.transaction(async (tx) => {
    const room = await lockRoom(tx, roomId);
    if (!room || room.status !== "LIVE") return null;
    const rows = await participantRows(tx, roomId);
    return rows.length === 0 ? endRoomTx(tx, roomId, rows, "empty") : null;
  });
}

export async function setHandRaised(roomId: string, userId: string, raised: boolean): Promise<PartyMutation> {
  return withLiveRoom(roomId, async (tx, _room, rows) => {
    const actor = policy.requireMember(rows.map(toMember), userId);
    if (raised) policy.assertCanRaiseHand(actor);
    const current = rows.find((row) => row.userId === userId)!;
    // Re-raising keeps the original place in the queue.
    await updateParticipant(tx, roomId, userId, {
      handRaisedAt: raised ? (current.handRaisedAt ?? new Date()) : null,
    });
    return mutation(roomId);
  });
}

export async function promote(roomId: string, actorId: string, targetId: string): Promise<PartyMutation> {
  return withLiveRoom(roomId, async (tx, _room, rows) => {
    const members = rows.map(toMember);
    policy.assertCanPromote(policy.requireMember(members, actorId), members, targetId);
    // New speakers start muted: they choose when to talk.
    await updateParticipant(tx, roomId, targetId, { role: "SPEAKER", handRaisedAt: null, muted: true });
    return mutation(roomId);
  });
}

export async function declineHand(roomId: string, actorId: string, targetId: string): Promise<PartyMutation> {
  return withLiveRoom(roomId, async (tx, _room, rows) => {
    const members = rows.map(toMember);
    policy.assertCanDeclineHand(policy.requireMember(members, actorId), members, targetId);
    await updateParticipant(tx, roomId, targetId, { handRaisedAt: null });
    const target = rows.find((row) => row.userId === targetId)!;
    return mutation(roomId, { handDeclinedSocketId: target.socketId });
  });
}

export async function demote(roomId: string, actorId: string, targetId: string): Promise<PartyMutation> {
  return withLiveRoom(roomId, async (tx, _room, rows) => {
    const members = rows.map(toMember);
    policy.assertCanDemote(policy.requireMember(members, actorId), members, targetId);
    await updateParticipant(tx, roomId, targetId, { role: "LISTENER", muted: true });
    return mutation(roomId);
  });
}

export async function removeParticipant(roomId: string, actorId: string, targetId: string): Promise<PartyMutation> {
  return withLiveRoom(roomId, async (tx, _room, rows) => {
    const members = rows.map(toMember);
    policy.assertCanRemove(policy.requireMember(members, actorId), members, targetId);
    const target = rows.find((row) => row.userId === targetId)!;
    await tx
      .delete(partyRoomParticipants)
      .where(and(eq(partyRoomParticipants.roomId, roomId), eq(partyRoomParticipants.userId, targetId)));
    return mutation(roomId, { evictSocketIds: [target.socketId], removedSocketIds: [target.socketId] });
  });
}

/** A speaker's own microphone state, mirrored so everyone sees who is muted. */
export async function setMuted(roomId: string, userId: string, muted: boolean): Promise<PartyMutation> {
  return withLiveRoom(roomId, async (tx, _room, rows) => {
    const actor = policy.requireMember(rows.map(toMember), userId);
    if (!muted && !partyRoleSpeaks(actor.role)) {
      throw new AppError("Only speakers can unmute", 403, "FORBIDDEN");
    }
    await updateParticipant(tx, roomId, userId, { muted });
    return mutation(roomId);
  });
}

export async function muteParticipant(roomId: string, actorId: string, targetId: string): Promise<PartyMutation> {
  return withLiveRoom(roomId, async (tx, _room, rows) => {
    const members = rows.map(toMember);
    policy.assertCanMuteOther(policy.requireMember(members, actorId), members, targetId);
    await updateParticipant(tx, roomId, targetId, { muted: true });
    const target = rows.find((row) => row.userId === targetId)!;
    return mutation(roomId, { forceMuteSocketId: target.socketId });
  });
}
