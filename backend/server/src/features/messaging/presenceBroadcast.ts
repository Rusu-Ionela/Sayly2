import { emitUserOnlineStatus } from "./gateway";
import { getPresence } from "./presence";
import { listPartnerIds } from "./repository";

/**
 * Pushes a user's current presence (already masked by their "Show online status"
 * setting) to their chat partners. Used on disconnect, by the stale-lease sweeper, and
 * when the user changes the setting, so partners never keep a stale "Online".
 */
export async function broadcastPresence(userId: string, persistedLastSeen?: Date | null) {
  const partnerIds = await listPartnerIds(userId, 100);
  if (partnerIds.length === 0) {
    return;
  }
  const snapshot = await getPresence(userId, persistedLastSeen);
  emitUserOnlineStatus({ userId, ...snapshot }, partnerIds);
}
