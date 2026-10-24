import { env } from "../../config/env";

export function redisKey(...parts: string[]) {
  return [env.redisKeyPrefix, ...parts].join(":");
}

export function rateLimitKey(action: string, identity: string) {
  return redisKey("rl", action, identity);
}

export function concurrencyKey(scope: string, identity: string) {
  return redisKey("conc", scope, identity);
}

export function presenceLeaseKey(socketId: string) {
  return redisKey("presence", "lease", socketId);
}

export function presenceUserKey(userId: string) {
  return redisKey("presence", "user", userId);
}

export function presenceExpiryKey() {
  return redisKey("presence", "expiries");
}

export function translationLockKey(messageId: string, targetLang: string, sourceHash: string) {
  return redisKey("lock", "translate", messageId, targetLang, sourceHash);
}

export function callKey(callId: string) {
  return redisKey("call", callId);
}

/** Marks a user as busy; value is the call id. */
export function callUserKey(userId: string) {
  return redisKey("call-user", userId);
}

export function revocationChannel() {
  return redisKey("revoke");
}
