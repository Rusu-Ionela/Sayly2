import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Presence privacy reads UserSettings; tests run without a database.
const hiddenUsers = new Set<string>();
vi.mock("../../features/users/settings", () => ({
  usersHiding: async (_setting: string, ids: string[]) =>
    new Set(ids.filter((id) => hiddenUsers.has(id))),
}));

import { getMemoryRedis, setRedisCommandsForTests } from "../redis/client";
import { presenceExpiryKey, presenceLeaseKey } from "../redis/keys";
import {
  getPresence,
  getPresenceMany,
  markOffline,
  markOnline,
} from "../../features/messaging/presence";
import { countLiveLeases, sweepExpiredPresenceLeases } from "./leases";
import type { RedisCommands } from "../redis/types";

describe("redis presence leases", () => {
  beforeEach(() => {
    hiddenUsers.clear();
    getMemoryRedis().reset();
    setRedisCommandsForTests(getMemoryRedis());
  });

  afterEach(() => {
    setRedisCommandsForTests(null);
  });

  it("keeps a user online when one of two sockets disconnects", async () => {
    await markOnline("user-a", "socket-1");
    await markOnline("user-a", "socket-2");
    expect(await countLiveLeases("user-a")).toBe(2);

    const lastSeen = await markOffline("user-a", "socket-1");
    expect(lastSeen).toBeNull();
    expect((await getPresence("user-a")).onlineStatus).toBe("ONLINE");

    const wentOffline = await markOffline("user-a", "socket-2");
    expect(wentOffline).toBeInstanceOf(Date);
    expect((await getPresence("user-a")).onlineStatus).toBe("OFFLINE");
  });

  it("treats expired leases after a crash as offline once swept", async () => {
    await markOnline("user-b", "socket-crash");
    await getMemoryRedis().del(presenceLeaseKey("socket-crash"));
    await getMemoryRedis().zAdd(presenceExpiryKey(), Date.now() - 1_000, "user-b|socket-crash");
    const newlyOffline = await sweepExpiredPresenceLeases(10);
    expect(newlyOffline).toContain("user-b");
    expect((await getPresence("user-b")).onlineStatus).toBe("OFFLINE");
  });

  it("does not claim offline when redis cannot be read", async () => {
    const failing = {
      async sMembers() {
        throw new Error("redis down");
      },
    } as unknown as RedisCommands;
    setRedisCommandsForTests(failing);
    const snapshot = await getPresence("user-c", new Date("2026-01-01T00:00:00.000Z"));
    expect(snapshot.onlineStatus).toBe("UNKNOWN");
    expect(snapshot.lastSeen).toBe("2026-01-01T00:00:00.000Z");
  });

  it("never reveals presence of users who hide their online status", async () => {
    await markOnline("user-d", "socket-1");
    hiddenUsers.add("user-d");

    expect(await getPresence("user-d")).toEqual({ onlineStatus: "UNKNOWN", lastSeen: null });
    const many = await getPresenceMany([{ userId: "user-d" }, { userId: "user-e" }]);
    expect(many.get("user-d")).toEqual({ onlineStatus: "UNKNOWN", lastSeen: null });
    expect(many.get("user-e")?.onlineStatus).toBe("OFFLINE");
  });
});
