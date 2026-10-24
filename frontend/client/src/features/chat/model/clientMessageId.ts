/**
 * Create a stable client-side message id for optimistic send + HTTP fallback.
 * The same id must be reused for socket, HTTP fallback, and retry.
 */
export function createClientMessageId() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return `msg-${cryptoApi.randomUUID()}`;
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Reuse an existing id on HTTP fallback / retry; mint only for a fresh send. */
export function resolveClientMessageId(existingClientMessageId?: string) {
  return existingClientMessageId ?? createClientMessageId();
}

export function isLocalMessageId(id: string) {
  return id.startsWith("local-") || id.startsWith("msg-");
}
