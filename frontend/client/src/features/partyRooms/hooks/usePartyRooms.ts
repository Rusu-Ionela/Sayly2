import type { ListPartyRoomsQuery } from "@sayly/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

import { createPartyRoom, listPartyRooms } from "../api";

/** Live rooms for the lobby (or one group). Rooms come and go, so it refreshes on its own. */
export function usePartyRooms(filter: ListPartyRoomsQuery, enabled = true) {
  return useQuery({
    queryKey: queryKeys.partyRooms.list(filter),
    queryFn: ({ signal }) => listPartyRooms(filter, { signal }),
    enabled,
    staleTime: 5_000,
    refetchInterval: 20_000,
  });
}

export function useCreatePartyRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPartyRoom,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.partyRooms.all });
    },
  });
}
