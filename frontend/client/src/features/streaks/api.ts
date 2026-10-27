import type { StreakDto } from "@sayly/shared";

import { apiClient } from "@/lib/apiClient";

export function getMyStreak() {
  return apiClient.get<StreakDto>("/streaks/me");
}

/** Counts today; the server works out "today" in the device time zone. */
export function checkIn(timezone: string | undefined) {
  return apiClient.post<StreakDto>("/streaks/me/check-in", timezone ? { timezone } : {});
}
