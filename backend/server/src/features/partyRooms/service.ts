import type { ListPartyRoomsQuery, PartyRoomDto, PartyRoomSummaryDto } from "@sayly/shared";

import { AppError } from "../../shared/errors/AppError";
import { currentCallId } from "../calls/service";
import { assertCanReadContent } from "../groups/policy";
import { getGroupAccess, listActiveGroupIdsOf } from "../groups/repository";
import { normalizeLanguageCode } from "../languages/catalog";

import * as repository from "./repository";

/** Group rooms are for the group's active members only; open rooms are for everyone. */
async function assertRoomAccess(userId: string, groupId: string | null) {
  if (!groupId) return;
  const { membership } = await getGroupAccess(groupId, userId);
  assertCanReadContent(membership);
}

/** POST /party-rooms — the host then joins over the socket (`party_join`). */
export async function createRoom(
  userId: string,
  input: { title: string; languageId: string; groupId?: string },
): Promise<{ id: string }> {
  const languageId = normalizeLanguageCode(input.languageId);
  if (!languageId) {
    throw new AppError("Unknown language", 400, "VALIDATION_ERROR", { languageId: "Unknown language" });
  }
  const groupId = input.groupId ?? null;
  await assertRoomAccess(userId, groupId);
  const room = await repository.createRoom({ hostId: userId, title: input.title, languageId, groupId });
  return { id: room.id };
}

/** GET /party-rooms — open rooms, or one group's rooms for its members. */
export async function listRooms(userId: string, query: ListPartyRoomsQuery): Promise<PartyRoomSummaryDto[]> {
  if (query.groupId) {
    await assertRoomAccess(userId, query.groupId);
  }
  const languageId = query.languageId ? normalizeLanguageCode(query.languageId) : undefined;
  return repository.listLiveRooms({
    languageId: languageId ?? undefined,
    groupId: query.groupId,
    visibleGroupIds: query.groupId ? [query.groupId] : await listActiveGroupIdsOf(userId),
  });
}

/** GET /party-rooms/:id — a preview before joining. */
export async function getRoom(userId: string, roomId: string): Promise<PartyRoomDto> {
  const room = await repository.findRoom(roomId);
  if (!room || room.status !== "LIVE") {
    throw new AppError("This room has ended", 404, "NOT_FOUND");
  }
  await assertRoomAccess(userId, room.groupId);
  const dto = await repository.loadRoomDto(roomId);
  if (!dto) throw new AppError("This room has ended", 404, "NOT_FOUND");
  return dto;
}

/**
 * Checks before a socket join: access to the room, and no 1:1 call in progress (both would
 * need the microphone). Returns the room the member is leaving, if they were in another one.
 */
export async function prepareJoin(userId: string, roomId: string): Promise<{ previousRoomId: string | null }> {
  const room = await repository.findRoom(roomId);
  if (!room || room.status !== "LIVE") {
    throw new AppError("This room has ended", 404, "NOT_FOUND");
  }
  await assertRoomAccess(userId, room.groupId);
  if (await currentCallId(userId)) {
    throw new AppError("Finish your call before joining a room", 409, "CALL_BUSY");
  }
  const participation = await repository.findParticipation(userId);
  return { previousRoomId: participation && participation.roomId !== roomId ? participation.roomId : null };
}
