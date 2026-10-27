type CacheOptions<T> = {
  /** 0 turns caching off (tests read the database every time). */
  ttlMs: number;
  maxEntries: number;
  load: (userId: string) => Promise<T | null>;
  now?: () => number;
};

/**
 * Short-lived per-process cache of the user row that `authenticate` checks on every request.
 * Revocations (password change, logout, deletion) call `invalidate` on every API instance,
 * and `ttlMs` bounds staleness if such an event is ever missed. Misses are never cached.
 */
export function createAuthUserCache<T>({ ttlMs, maxEntries, load, now = Date.now }: CacheOptions<T>) {
  const entries = new Map<string, { value: T; expiresAt: number }>();

  return {
    async get(userId: string): Promise<T | null> {
      const hit = entries.get(userId);
      if (hit && hit.expiresAt > now()) {
        return hit.value;
      }
      entries.delete(userId);
      const value = await load(userId);
      if (value && ttlMs > 0) {
        if (entries.size >= maxEntries) {
          // Oldest insertion first: Map iteration follows insertion order.
          const oldest = entries.keys().next().value;
          if (oldest !== undefined) entries.delete(oldest);
        }
        entries.set(userId, { value, expiresAt: now() + ttlMs });
      }
      return value;
    },
    invalidate(userId: string) {
      entries.delete(userId);
    },
  };
}
