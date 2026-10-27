import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

import { getFriendsLeaderboard } from "./api";

export function useFriendsLeaderboard() {
  return useQuery({
    queryKey: queryKeys.leaderboard.friends,
    queryFn: getFriendsLeaderboard,
  });
}
