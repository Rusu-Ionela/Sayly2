import { CONCURRENCY_ACQUIRE_SCRIPT, RATE_LIMIT_SCRIPT } from "./types";
import type { RedisCommands, RedisSetOptions, RedisSubscriber } from "./types";

type StoredValue = {
  value: string;
  expiresAt: number | null;
};

type MemoryListener = (message: string) => void;

export class MemoryRedis implements RedisCommands, RedisSubscriber {
  private readonly values = new Map<string, StoredValue>();
  private readonly sets = new Map<string, Set<string>>();
  private readonly zsets = new Map<string, Map<string, number>>();
  private readonly channels = new Map<string, Set<MemoryListener>>();

  reset() {
    this.values.clear();
    this.sets.clear();
    this.zsets.clear();
  }

  async ping() {
    return "PONG";
  }

  async eval(script: string, keys: string[], args: string[]): Promise<unknown> {
    if (script.includes("sayly:rate-limit")) {
      const key = keys[0];
      const windowMs = Number(args[0]);
      if (!key || !Number.isFinite(windowMs)) {
        throw new Error("Invalid rate limit script arguments");
      }
      const count = await this.incr(key);
      if (count === 1) {
        await this.pexpire(key, windowMs);
      }
      let ttl = await this.pttl(key);
      if (ttl < 0) {
        await this.pexpire(key, windowMs);
        ttl = windowMs;
      }
      return [count, ttl];
    }

    if (script.includes("sayly:concurrency-acquire")) {
      const key = keys[0];
      const max = Number(args[0]);
      const ttlMs = Number(args[1]);
      if (!key || !Number.isFinite(max) || !Number.isFinite(ttlMs)) {
        throw new Error("Invalid concurrency script arguments");
      }
      const count = await this.incr(key);
      if (count === 1) {
        await this.pexpire(key, ttlMs);
      }
      if (count > max) {
        await this.decr(key);
        return 0;
      }
      return 1;
    }

    throw new Error("Unsupported Lua script in MemoryRedis");
  }

  async get(key: string) {
    const stored = this.readValue(key);
    return stored ? stored.value : null;
  }

  async set(key: string, value: string, options?: RedisSetOptions) {
    const existing = this.readValue(key);
    if (options?.nx && existing) {
      return null;
    }
    this.values.set(key, {
      value,
      expiresAt: options?.px ? Date.now() + options.px : null,
    });
    return "OK";
  }

  async del(...keys: string[]) {
    let removed = 0;
    for (const key of keys) {
      if (this.values.delete(key) || this.sets.delete(key) || this.zsets.delete(key)) {
        removed += 1;
      }
    }
    return removed;
  }

  async incr(key: string) {
    const current = Number(this.readValue(key)?.value ?? "0");
    const next = current + 1;
    const expiresAt = this.values.get(key)?.expiresAt ?? null;
    this.values.set(key, { value: String(next), expiresAt });
    return next;
  }

  async decr(key: string) {
    const current = Number(this.readValue(key)?.value ?? "0");
    const next = current - 1;
    const expiresAt = this.values.get(key)?.expiresAt ?? null;
    this.values.set(key, { value: String(next), expiresAt });
    return next;
  }

  async pttl(key: string) {
    const stored = this.values.get(key);
    if (!stored) {
      return -2;
    }
    if (stored.expiresAt === null) {
      return -1;
    }
    const remaining = stored.expiresAt - Date.now();
    if (remaining <= 0) {
      this.values.delete(key);
      return -2;
    }
    return remaining;
  }

  async pexpire(key: string, milliseconds: number) {
    const stored = this.readValue(key);
    if (!stored) {
      return 0;
    }
    this.values.set(key, { value: stored.value, expiresAt: Date.now() + milliseconds });
    return 1;
  }

  async exists(...keys: string[]) {
    let count = 0;
    for (const key of keys) {
      if (this.readValue(key) || this.readSet(key).size > 0) {
        count += 1;
      }
    }
    return count;
  }

  async sAdd(key: string, member: string) {
    const set = this.readSet(key);
    const before = set.size;
    set.add(member);
    this.sets.set(key, set);
    return set.size === before ? 0 : 1;
  }

  async sRem(key: string, member: string) {
    const set = this.readSet(key);
    const removed = set.delete(member) ? 1 : 0;
    if (set.size === 0) {
      this.sets.delete(key);
    } else {
      this.sets.set(key, set);
    }
    return removed;
  }

  async sMembers(key: string) {
    return [...this.readSet(key)];
  }

  async sCard(key: string) {
    return this.readSet(key).size;
  }

  async zAdd(key: string, score: number, member: string) {
    const zset = this.zsets.get(key) ?? new Map<string, number>();
    zset.set(member, score);
    this.zsets.set(key, zset);
    return 1;
  }

  async zRem(key: string, member: string) {
    const zset = this.zsets.get(key);
    if (!zset) {
      return 0;
    }
    const removed = zset.delete(member) ? 1 : 0;
    if (zset.size === 0) {
      this.zsets.delete(key);
    }
    return removed;
  }

  async zRangeByScore(key: string, min: number, max: number, limit: number) {
    const zset = this.zsets.get(key);
    if (!zset) {
      return [];
    }
    return [...zset.entries()]
      .filter(([, score]) => score >= min && score <= max)
      .sort((left, right) => left[1] - right[1])
      .slice(0, limit)
      .map(([member]) => member);
  }

  async publish(channel: string, message: string) {
    const listeners = this.channels.get(channel);
    if (!listeners) {
      return 0;
    }
    for (const listener of listeners) {
      listener(message);
    }
    return listeners.size;
  }

  async subscribe(channel: string, listener: MemoryListener) {
    const listeners = this.channels.get(channel) ?? new Set<MemoryListener>();
    listeners.add(listener);
    this.channels.set(channel, listeners);
  }

  async unsubscribe(channel: string) {
    this.channels.delete(channel);
  }

  private readValue(key: string): StoredValue | null {
    const stored = this.values.get(key);
    if (!stored) {
      return null;
    }
    if (stored.expiresAt !== null && stored.expiresAt <= Date.now()) {
      this.values.delete(key);
      return null;
    }
    return stored;
  }

  private readSet(key: string): Set<string> {
    return this.sets.get(key) ?? new Set<string>();
  }
}

void RATE_LIMIT_SCRIPT;
void CONCURRENCY_ACQUIRE_SCRIPT;
