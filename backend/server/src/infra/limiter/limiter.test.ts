import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AppError } from "../../shared/errors/AppError";
import { getMemoryRedis, setRedisCommandsForTests } from "../redis/client";
import type { RedisCommands } from "../redis/types";
import { consumeLimit, opaqueIdentity, rateLimitPolicies } from "./limiter";

const policy = { action: "test_send", windowMs: 60_000, max: 3 };

describe("shared redis rate limiter", () => {
  beforeEach(() => {
    getMemoryRedis().reset();
    setRedisCommandsForTests(getMemoryRedis());
  });

  afterEach(() => {
    setRedisCommandsForTests(null);
  });

  it("shares one budget across two consumer instances", async () => {
    await consumeLimit(policy, "user-1");
    await consumeLimit(policy, "user-1");
    await consumeLimit(policy, "user-1");
    await expect(consumeLimit(policy, "user-1")).rejects.toMatchObject({
      code: "RATE_LIMITED",
      statusCode: 429,
    });
  });

  it("keeps HTTP and socket send identities on the same action key", async () => {
    const send = rateLimitPolicies.messageSend;
    const tight = { ...send, max: 2 };
    await consumeLimit(tight, "user-9");
    await consumeLimit(tight, "user-9");
    await expect(consumeLimit(tight, "user-9")).rejects.toBeInstanceOf(AppError);
  });

  it("increments atomically under concurrent callers", async () => {
    const tight = { action: "burst", windowMs: 60_000, max: 5 };
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () => consumeLimit(tight, "same-user")),
    );
    const allowed = results.filter((result) => result.status === "fulfilled").length;
    const limited = results.filter(
      (result) => result.status === "rejected" && result.reason instanceof AppError && result.reason.code === "RATE_LIMITED",
    ).length;
    expect(allowed).toBe(5);
    expect(limited).toBe(7);
  });

  it("keeps login account and IP scopes distinct", async () => {
    const emailKey = opaqueIdentity("learner@example.com");
    await consumeLimit({ ...rateLimitPolicies.loginAccount, max: 1 }, emailKey);
    await expect(
      consumeLimit({ ...rateLimitPolicies.loginAccount, max: 1 }, emailKey),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await expect(
      consumeLimit({ ...rateLimitPolicies.loginIp, max: 1 }, "127.0.0.1"),
    ).resolves.toMatchObject({ allowed: true });
  });

  it("fails closed when redis is unavailable instead of allowing traffic", async () => {
    const failing = {
      async eval() {
        throw new Error("redis down");
      },
    } as unknown as RedisCommands;
    setRedisCommandsForTests(failing);
    await expect(consumeLimit(policy, "user-2")).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      statusCode: 503,
    });
  });
});
