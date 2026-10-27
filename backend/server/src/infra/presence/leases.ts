import { env } from "../../config/env";
import { getRedis } from "../redis/client";
import { presenceExpiryKey, presenceLeaseKey, presenceUserKey } from "../redis/keys";

const MEMBER_SEPARATOR = "|";

function expiryMember(userId: string, socketId: string) {
  return `${userId}${MEMBER_SEPARATOR}${socketId}`;
}

function parseExpiryMember(member: string): { userId: string; socketId: string } | null {
  const separator = member.indexOf(MEMBER_SEPARATOR);
  if (separator <= 0) {
    return null;
  }
  return {
    userId: member.slice(0, separator),
    socketId: member.slice(separator + 1),
  };
}

export async function addPresenceLease(userId: string, socketId: string) {
  const redis = getRedis();
  const expiresAt = Date.now() + env.presenceLeaseTtlMs;
  await redis.set(presenceLeaseKey(socketId), userId, { px: env.presenceLeaseTtlMs });
  await redis.sAdd(presenceUserKey(userId), socketId);
  await redis.zAdd(presenceExpiryKey(), expiresAt, expiryMember(userId, socketId));
}

export async function refreshPresenceLease(userId: string, socketId: string) {
  const redis = getRedis();
  const leaseKey = presenceLeaseKey(socketId);
  const owner = await redis.get(leaseKey);
  if (owner && owner !== userId) {
    return false;
  }
  await redis.set(leaseKey, userId, { px: env.presenceLeaseTtlMs });
  await redis.sAdd(presenceUserKey(userId), socketId);
  await redis.zAdd(presenceExpiryKey(), Date.now() + env.presenceLeaseTtlMs, expiryMember(userId, socketId));
  return true;
}

export async function removePresenceLease(userId: string, socketId: string): Promise<number> {
  const redis = getRedis();
  await redis.del(presenceLeaseKey(socketId));
  await redis.sRem(presenceUserKey(userId), socketId);
  await redis.zRem(presenceExpiryKey(), expiryMember(userId, socketId));
  return countLiveLeases(userId);
}

export async function countLiveLeases(userId: string): Promise<number> {
  const redis = getRedis();
  const socketIds = await redis.sMembers(presenceUserKey(userId));
  if (socketIds.length === 0) {
    return 0;
  }

  let live = 0;
  for (const socketId of socketIds) {
    const exists = await redis.exists(presenceLeaseKey(socketId));
    if (exists) {
      live += 1;
    } else {
      await redis.sRem(presenceUserKey(userId), socketId);
      await redis.zRem(presenceExpiryKey(), expiryMember(userId, socketId));
    }
  }
  return live;
}

export async function countLiveLeasesMany(userIds: string[]): Promise<Map<string, number | null>> {
  const counts = new Map<string, number | null>();
  const uniqueIds = [...new Set(userIds)];
  const batchSize = 25;

  for (let index = 0; index < uniqueIds.length; index += batchSize) {
    const batch = uniqueIds.slice(index, index + batchSize);
    const results = await Promise.all(
      batch.map(async (userId) => {
        try {
          return { userId, count: await countLiveLeases(userId) };
        } catch {
          return { userId, count: null };
        }
      }),
    );
    for (const result of results) {
      counts.set(result.userId, result.count);
    }
  }

  return counts;
}

export async function sweepExpiredPresenceLeases(limit = 100): Promise<string[]> {
  const redis = getRedis();
  const due = await redis.zRangeByScore(presenceExpiryKey(), 0, Date.now(), limit);
  const newlyOfflineUserIds: string[] = [];

  for (const member of due) {
    const parsed = parseExpiryMember(member);
    if (!parsed) {
      await redis.zRem(presenceExpiryKey(), member);
      continue;
    }

    const leaseExists = await redis.exists(presenceLeaseKey(parsed.socketId));
    if (leaseExists) {
      continue;
    }

    await redis.sRem(presenceUserKey(parsed.userId), parsed.socketId);
    await redis.zRem(presenceExpiryKey(), member);
    const remaining = await countLiveLeases(parsed.userId);
    if (remaining === 0) {
      newlyOfflineUserIds.push(parsed.userId);
    }
  }

  return [...new Set(newlyOfflineUserIds)];
}

/**
 * Ids of members with at least one unexpired lease, read from the expiry index (score =
 * lease expiry). Bounded by `limit` leases, so a busy server returns a sample, not everyone.
 */
export async function listLiveUserIds(limit = 500): Promise<string[]> {
  const redis = getRedis();
  const members = await redis.zRangeByScore(presenceExpiryKey(), Date.now(), Number.MAX_SAFE_INTEGER, limit);
  const ids = new Set<string>();
  for (const member of members) {
    const parsed = parseExpiryMember(member);
    if (parsed) ids.add(parsed.userId);
  }
  return [...ids];
}
