import { describe, expect, it, vi } from "vitest";

import { createAuthUserCache } from "./authUserCache";

function setup(ttlMs = 5_000, maxEntries = 10) {
  let clock = 1_000;
  const load = vi.fn(async (id: string) => (id === "missing" ? null : { id, version: clock }));
  const cache = createAuthUserCache({ ttlMs, maxEntries, load, now: () => clock });
  return { cache, load, advance: (ms: number) => (clock += ms) };
}

describe("auth user cache", () => {
  it("reads the database once within the TTL", async () => {
    const { cache, load } = setup();
    await cache.get("u1");
    await cache.get("u1");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("reloads after the TTL and after an invalidation", async () => {
    const { cache, load, advance } = setup();
    await cache.get("u1");
    advance(5_001);
    await cache.get("u1");
    cache.invalidate("u1");
    await cache.get("u1");
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("never caches a missing user", async () => {
    const { cache, load } = setup();
    expect(await cache.get("missing")).toBeNull();
    await cache.get("missing");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("is off with a TTL of 0", async () => {
    const { cache, load } = setup(0);
    await cache.get("u1");
    await cache.get("u1");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("evicts the oldest entry when full", async () => {
    const { cache, load } = setup(5_000, 2);
    await cache.get("a");
    await cache.get("b");
    await cache.get("c");
    await cache.get("b");
    await cache.get("a");
    expect(load.mock.calls.map(([id]) => id)).toEqual(["a", "b", "c", "a"]);
  });
});
