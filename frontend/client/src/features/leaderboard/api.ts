import type { FriendsLeaderboardDto } from "@sayly/shared";

import { apiClient } from "@/lib/apiClient";

export function getFriendsLeaderboard() {
  return apiClient.get<FriendsLeaderboardDto>("/leaderboard/friends");
}
