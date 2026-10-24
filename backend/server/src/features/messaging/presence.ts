import {
  addPresenceLease,
  countLiveLeases,
  countLiveLeasesMany,
  refreshPresenceLease,
  removePresenceLease,
  sweepExpiredPresenceLeases,
} from "../../infra/presence/leases";
import { logger } from "../../shared/utils/logger";
import { usersHiding } from "../users/settings";
import type { OnlineStatus } from "./types";

const lastSeenByUser = new Map<string, Date>();
const MAX_LAST_SEEN = 5_000;

export type PresenceSnapshot = {
  onlineStatus: OnlineStatus;
  lastSeen: string | null;
};

function rememberLastSeen(userId: string, at: Date) {
  lastSeenByUser.set(userId, at);
  if (lastSeenByUser.size > MAX_LAST_SEEN) {
    const oldest = lastSeenByUser.keys().next().value;
    if (oldest) {
      lastSeenByUser.delete(oldest);
    }
  }
}

export async function markOnline(userId: string, socketId: string) {
  await addPresenceLease(userId, socketId);
}

export async function refreshOnline(userId: string, socketId: string) {
  return refreshPresenceLease(userId, socketId);
}

export async function markOffline(userId: string, socketId: string): Promise<Date | null> {
  const remaining = await removePresenceLease(userId, socketId);
  if (remaining > 0) {
    return null;
  }
  const at = new Date();
  rememberLastSeen(userId, at);
  return at;
}

export async function isOnline(userId: string) {
  try {
    return (await countLiveLeases(userId)) > 0;
  } catch {
    return false;
  }
}

export function getCachedLastSeen(userId: string): Date | null {
  return lastSeenByUser.get(userId) ?? null;
}

/** What others see for a user who hides their online status. */
const HIDDEN_PRESENCE: PresenceSnapshot = { onlineStatus: "UNKNOWN", lastSeen: null };

/** Fails closed: if the privacy lookup errors, nobody's status is revealed. */
async function hiddenPresenceUsers(userIds: string[]): Promise<Set<string> | "all"> {
  try {
    return await usersHiding("showOnlineStatus", userIds);
  } catch (error) {
    logger.warn("presence", "privacy lookup failed; hiding presence", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return "all";
  }
}

function toSnapshot(
  status: OnlineStatus,
  lastSeen: Date | null | undefined,
): PresenceSnapshot {
  return {
    onlineStatus: status,
    lastSeen: lastSeen ? lastSeen.toISOString() : null,
  };
}

export async function getPresence(userId: string, persistedLastSeen?: Date | null): Promise<PresenceSnapshot> {
  const hidden = await hiddenPresenceUsers([userId]);
  if (hidden === "all" || hidden.has(userId)) {
    return HIDDEN_PRESENCE;
  }
  try {
    const live = await countLiveLeases(userId);
    if (live > 0) {
      return toSnapshot("ONLINE", new Date());
    }
    return toSnapshot("OFFLINE", getCachedLastSeen(userId) ?? persistedLastSeen ?? null);
  } catch {
    return toSnapshot("UNKNOWN", persistedLastSeen ?? getCachedLastSeen(userId));
  }
}

export async function getPresenceMany(
  requested: Array<{ userId: string; persistedLastSeen?: Date | null }>,
): Promise<Map<string, PresenceSnapshot>> {
  const snapshots = new Map<string, PresenceSnapshot>();
  if (requested.length === 0) {
    return snapshots;
  }

  const hidden = await hiddenPresenceUsers(requested.map((entry) => entry.userId));
  const entries: typeof requested = [];
  for (const entry of requested) {
    if (hidden === "all" || hidden.has(entry.userId)) {
      snapshots.set(entry.userId, HIDDEN_PRESENCE);
    } else {
      entries.push(entry);
    }
  }
  if (entries.length === 0) {
    return snapshots;
  }

  try {
    const counts = await countLiveLeasesMany(entries.map((entry) => entry.userId));
    for (const entry of entries) {
      const count = counts.get(entry.userId);
      if (count === null || count === undefined) {
        snapshots.set(entry.userId, toSnapshot("UNKNOWN", entry.persistedLastSeen ?? getCachedLastSeen(entry.userId)));
        continue;
      }
      if (count > 0) {
        snapshots.set(entry.userId, toSnapshot("ONLINE", new Date()));
        continue;
      }
      snapshots.set(
        entry.userId,
        toSnapshot("OFFLINE", getCachedLastSeen(entry.userId) ?? entry.persistedLastSeen ?? null),
      );
    }
    return snapshots;
  } catch {
    for (const entry of entries) {
      snapshots.set(entry.userId, toSnapshot("UNKNOWN", entry.persistedLastSeen ?? getCachedLastSeen(entry.userId)));
    }
    return snapshots;
  }
}

export async function sweepStalePresence(): Promise<Array<{ userId: string; lastSeen: Date }>> {
  try {
    const userIds = await sweepExpiredPresenceLeases(100);
    const now = new Date();
    return userIds.map((userId) => {
      rememberLastSeen(userId, now);
      return { userId, lastSeen: now };
    });
  } catch (error) {
    logger.warn("presence", "lease sweep skipped", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return [];
  }
}
