import { createHash } from "crypto";

import { PARTY_REACTION_LIMIT, PARTY_REACTION_WINDOW_MS } from "@sayly/shared";

import { env } from "../../config/env";
import { AppError } from "../../shared/errors/AppError";
import { getRedis } from "../redis/client";
import { concurrencyKey, rateLimitKey } from "../redis/keys";
import { CONCURRENCY_ACQUIRE_SCRIPT, RATE_LIMIT_SCRIPT } from "../redis/types";

export type RateLimitPolicy = {
  action: string;
  windowMs: number;
  max: number;
};

export const rateLimitPolicies = {
  registerIp: { action: "register_ip", windowMs: env.authRateLimitWindowMs, max: env.authRateLimitMax },
  loginIp: { action: "login_ip", windowMs: env.authRateLimitWindowMs, max: env.loginIpRateLimitMax },
  loginAccount: { action: "login_account", windowMs: env.authRateLimitWindowMs, max: env.loginRateLimitMax },
  resetIssueIp: { action: "reset_issue_ip", windowMs: env.authRateLimitWindowMs, max: env.resetIpRateLimitMax },
  resetIssueAccount: { action: "reset_issue_account", windowMs: env.authRateLimitWindowMs, max: env.resetRateLimitMax },
  resetVerifyIp: { action: "reset_verify_ip", windowMs: env.authRateLimitWindowMs, max: env.resetIpRateLimitMax },
  refreshIp: { action: "refresh_ip", windowMs: 60_000, max: env.refreshRateLimitMax },
  logoutIp: { action: "logout_ip", windowMs: 60_000, max: 60 },
  passwordChange: { action: "password_change", windowMs: env.authRateLimitWindowMs, max: env.passwordChangeRateLimitMax },
  messageSend: { action: "message_send", windowMs: 60_000, max: env.messageSendRateLimitMax },
  upload: { action: "upload", windowMs: 60_000, max: env.uploadRateLimitMax },
  translate: { action: "translate", windowMs: 60_000, max: env.aiRateLimitMax },
  transcribe: { action: "transcribe", windowMs: 60_000, max: env.aiRateLimitMax },
  report: { action: "report", windowMs: 60 * 60 * 1000, max: env.reportRateLimitMax },
  mutation: { action: "mutation", windowMs: 60_000, max: env.mutationRateLimitMax },
  discovery: { action: "discovery", windowMs: 60_000, max: env.discoveryRateLimitMax },
  groupCreate: { action: "group_create", windowMs: 60 * 60 * 1000, max: 10 },
  groupAction: { action: "group_action", windowMs: 60_000, max: env.mutationRateLimitMax },
  socketConnect: { action: "socket_connect", windowMs: 60_000, max: env.socketConnectRateLimitMax },
  typing: { action: "typing", windowMs: 10_000, max: env.typingRateLimitMax },
  socketJoin: { action: "socket_join", windowMs: 60_000, max: 60 },
  messageRead: { action: "message_read", windowMs: 60_000, max: 60 },
  presenceQuery: { action: "presence_query", windowMs: 60_000, max: 60 },
  /** "Download my data" builds a large payload — a few per hour is plenty. */
  dataExport: { action: "data_export", windowMs: 60 * 60 * 1000, max: 5 },
  /** Contact / feature request / bug report — enough for real use, not for spam. */
  supportTicket: { action: "support_ticket", windowMs: 60 * 60 * 1000, max: 10 },
  callInvite: { action: "call_invite", windowMs: 60_000, max: 10 },
  callSignal: { action: "call_signal", windowMs: 10_000, max: 300 },
  /** Party Room joins and host/stage controls. */
  partyAction: { action: "party_action", windowMs: 60_000, max: 60 },
  partyReaction: { action: "party_reaction", windowMs: PARTY_REACTION_WINDOW_MS, max: PARTY_REACTION_LIMIT },
  /** A speaker negotiates with every participant (mesh), so far more than a 1:1 call. */
  partySignal: { action: "party_signal", windowMs: 10_000, max: 1_500 },
} as const satisfies Record<string, RateLimitPolicy>;

export function opaqueIdentity(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export function trustedClientIp(ip: string | undefined): string {
  if (!ip) {
    return "unknown";
  }
  return ip;
}

function redisUnavailable(action: string): never {
  throw new AppError(
    "Service is temporarily unavailable. Please try again shortly.",
    503,
    "SERVICE_UNAVAILABLE",
    { action },
    2,
  );
}

function asCountAndTtl(result: unknown): { count: number; ttlMs: number } {
  if (!Array.isArray(result) || result.length < 2) {
    throw new Error("Unexpected rate limit script result");
  }
  const count = Number(result[0]);
  const ttlMs = Number(result[1]);
  if (!Number.isFinite(count) || !Number.isFinite(ttlMs)) {
    throw new Error("Unexpected rate limit script result");
  }
  return { count, ttlMs };
}

export type ConsumeLimitResult = {
  allowed: true;
  remaining: number;
  resetMs: number;
};

export async function consumeLimit(policy: RateLimitPolicy, identity: string): Promise<ConsumeLimitResult> {
  try {
    const result = await getRedis().eval(RATE_LIMIT_SCRIPT, [rateLimitKey(policy.action, identity)], [
      String(policy.windowMs),
    ]);
    const { count, ttlMs } = asCountAndTtl(result);
    if (count > policy.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
      throw new AppError(
        "Too many requests. Please try again later.",
        429,
        "RATE_LIMITED",
        { action: policy.action, retryAfterSeconds: String(retryAfterSeconds) },
        retryAfterSeconds,
      );
    }
    return {
      allowed: true,
      remaining: Math.max(0, policy.max - count),
      resetMs: ttlMs,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    redisUnavailable(policy.action);
  }
}

export async function acquireConcurrency(scope: string, identity: string, max: number, ttlMs: number) {
  try {
    const result = await getRedis().eval(CONCURRENCY_ACQUIRE_SCRIPT, [concurrencyKey(scope, identity)], [
      String(max),
      String(ttlMs),
    ]);
    if (Number(result) !== 1) {
      throw new AppError(
        "Too many in-progress requests. Please try again shortly.",
        429,
        "RATE_LIMITED",
        { action: scope },
        2,
      );
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    redisUnavailable(scope);
  }
}

export async function releaseConcurrency(scope: string, identity: string) {
  try {
    const key = concurrencyKey(scope, identity);
    const next = await getRedis().decr(key);
    if (next <= 0) {
      await getRedis().del(key);
    }
  } catch {
    // Release is best-effort; the key TTL bounds leaked slots.
  }
}

export async function withConcurrency<T>(
  scope: string,
  identity: string,
  max: number,
  ttlMs: number,
  work: () => Promise<T>,
): Promise<T> {
  await acquireConcurrency(scope, identity, max, ttlMs);
  try {
    return await work();
  } finally {
    await releaseConcurrency(scope, identity);
  }
}

export async function acquireLock(key: string, owner: string, ttlMs: number): Promise<boolean> {
  try {
    const result = await getRedis().set(key, owner, { nx: true, px: ttlMs });
    return result === "OK";
  } catch {
    redisUnavailable("lock");
  }
}

export async function releaseLock(key: string, owner: string) {
  try {
    const current = await getRedis().get(key);
    if (current === owner) {
      await getRedis().del(key);
    }
  } catch {
    // Owner-safe release is best-effort; TTL prevents permanent locks.
  }
}
