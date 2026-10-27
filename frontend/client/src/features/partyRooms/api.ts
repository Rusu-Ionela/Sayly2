import type { CreatePartyRoomInput, ListPartyRoomsQuery, PartyRoomSummaryDto } from "@sayly/shared";

import { apiClient } from "@/lib/apiClient";

export function listPartyRooms(filter: ListPartyRoomsQuery, opts: { signal?: AbortSignal } = {}) {
  const params = new URLSearchParams();
  if (filter.groupId) params.set("groupId", filter.groupId);
  if (filter.languageId) params.set("languageId", filter.languageId);
  const query = params.toString();
  return apiClient
    .get<{ items: PartyRoomSummaryDto[] }>(`/party-rooms${query ? `?${query}` : ""}`, {
      signal: opts.signal,
    })
    .then((res) => res.items);
}

export const createPartyRoom = (input: CreatePartyRoomInput) =>
  apiClient.post<{ id: string }>("/party-rooms", input);
