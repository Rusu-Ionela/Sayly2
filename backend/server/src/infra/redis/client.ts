import { createClient, type RedisClientType } from "redis";

import { env } from "../../config/env";
import { logger } from "../../shared/utils/logger";
import { MemoryRedis } from "./memory";
import type { RedisCommands, RedisSetOptions, RedisSubscriber } from "./types";

type NodeRedisClient = RedisClientType;

let commandClient: RedisCommands | null = null;
let subscriber: RedisSubscriber | null = null;
let adapterPubClient: NodeRedisClient | null = null;
let adapterSubClient: NodeRedisClient | null = null;
let nodeClients: NodeRedisClient[] = [];
let memoryClient: MemoryRedis | null = null;
let closing = false;

function redisSocketOptions() {
  return {
    connectTimeout: env.redisConnectTimeoutMs,
    reconnectStrategy(retries: number) {
      if (retries > 16) {
        return new Error("Redis reconnect attempts exhausted");
      }
      return Math.min(200 * retries, 2_000);
    },
    tls: env.redisTls,
  };
}

function createNodeRedisClient(): NodeRedisClient {
  return createClient({
    url: env.redisUrl,
    username: env.redisUsername || undefined,
    password: env.redisPassword || undefined,
    socket: redisSocketOptions(),
    disableOfflineQueue: true,
    commandsQueueMaxLength: 128,
    pingInterval: 10_000,
  });
}

function attachClientLogs(client: NodeRedisClient, name: string) {
  client.on("connect", () => {
    logger.info("redis", "connecting", { client: name });
  });
  client.on("ready", () => {
    logger.info("redis", "ready", { client: name });
  });
  client.on("reconnecting", () => {
    logger.warn("redis", "reconnecting", { client: name });
  });
  client.on("end", () => {
    if (!closing) {
      logger.warn("redis", "connection ended", { client: name });
    }
  });
  client.on("error", (error) => {
    logger.error("redis", "client error", {
      client: name,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  });
}

class NodeRedisCommands implements RedisCommands {
  constructor(private readonly client: NodeRedisClient) {}

  private withTimeout<T>(work: Promise<T>): Promise<T> {
    return Promise.race([
      work,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error("Redis command timeout")), env.redisCommandTimeoutMs);
      }),
    ]);
  }

  async eval(script: string, keys: string[], args: string[]) {
    return this.withTimeout(this.client.eval(script, { keys, arguments: args }));
  }

  async get(key: string) {
    return this.client.get(key);
  }

  async set(key: string, value: string, options?: RedisSetOptions) {
    if (options?.nx && options.px) {
      return this.client.set(key, value, { NX: true, PX: options.px });
    }
    if (options?.nx) {
      return this.client.set(key, value, { NX: true });
    }
    if (options?.px) {
      return this.client.set(key, value, { PX: options.px });
    }
    return this.client.set(key, value);
  }

  async del(...keys: string[]) {
    if (keys.length === 0) {
      return 0;
    }
    return this.client.del(keys);
  }

  async incr(key: string) {
    return this.client.incr(key);
  }

  async decr(key: string) {
    return this.client.decr(key);
  }

  async pttl(key: string) {
    return this.client.pTTL(key);
  }

  async pexpire(key: string, milliseconds: number) {
    const updated = await this.client.pExpire(key, milliseconds);
    return updated ? 1 : 0;
  }

  async exists(...keys: string[]) {
    if (keys.length === 0) {
      return 0;
    }
    return this.client.exists(keys);
  }

  async sAdd(key: string, member: string) {
    return this.client.sAdd(key, member);
  }

  async sRem(key: string, member: string) {
    return this.client.sRem(key, member);
  }

  async sMembers(key: string) {
    return this.client.sMembers(key);
  }

  async sCard(key: string) {
    return this.client.sCard(key);
  }

  async zAdd(key: string, score: number, member: string) {
    return this.client.zAdd(key, { score, value: member });
  }

  async zRem(key: string, member: string) {
    return this.client.zRem(key, member);
  }

  async zRangeByScore(key: string, min: number, max: number, limit: number) {
    // ZRANGEBYSCORE, not ZRANGE ... BYSCORE: the latter needs Redis 6.2+, and local
    // Windows setups commonly run Redis 5 (it fails there with "ERR syntax error").
    return this.client.zRangeByScore(key, min, max, {
      LIMIT: { offset: 0, count: limit },
    });
  }

  async publish(channel: string, message: string) {
    return this.client.publish(channel, message);
  }

  async ping() {
    return this.withTimeout(this.client.ping());
  }
}

class NodeRedisSubscriber implements RedisSubscriber {
  constructor(private readonly client: NodeRedisClient) {}

  async subscribe(channel: string, listener: (message: string) => void) {
    await this.client.subscribe(channel, listener);
  }

  async unsubscribe(channel: string) {
    await this.client.unsubscribe(channel);
  }
}

export function getMemoryRedis(): MemoryRedis {
  if (!memoryClient) {
    memoryClient = new MemoryRedis();
  }
  return memoryClient;
}

export async function connectRedis() {
  if (commandClient) {
    return;
  }

  if (env.useMemoryRedis) {
    memoryClient = getMemoryRedis();
    commandClient = memoryClient;
    subscriber = memoryClient;
    logger.info("redis", "using in-memory redis", { reason: "REDIS_USE_MEMORY or NODE_ENV=test" });
    return;
  }

  const command = createNodeRedisClient();
  const adapterPub = command.duplicate();
  const adapterSub = command.duplicate();
  const revokeSub = command.duplicate();

  attachClientLogs(command, "command");
  attachClientLogs(adapterPub, "adapter-pub");
  attachClientLogs(adapterSub, "adapter-sub");
  attachClientLogs(revokeSub, "revoke-sub");

  await Promise.all([command.connect(), adapterPub.connect(), adapterSub.connect(), revokeSub.connect()]);

  commandClient = new NodeRedisCommands(command);
  subscriber = new NodeRedisSubscriber(revokeSub);
  adapterPubClient = adapterPub;
  adapterSubClient = adapterSub;
  nodeClients = [command, adapterPub, adapterSub, revokeSub];
}

export function setRedisCommandsForTests(client: RedisCommands | null) {
  if (client) {
    commandClient = client;
    return;
  }
  commandClient = env.useMemoryRedis ? getMemoryRedis() : commandClient;
}

export function getRedis(): RedisCommands {
  if (!commandClient) {
    if (env.useMemoryRedis) {
      commandClient = getMemoryRedis();
      subscriber = getMemoryRedis();
      return commandClient;
    }
    throw new Error("Redis has not been connected");
  }
  return commandClient;
}

export function getRedisSubscriber(): RedisSubscriber {
  if (!subscriber) {
    if (env.useMemoryRedis) {
      subscriber = getMemoryRedis();
      return subscriber;
    }
    throw new Error("Redis subscriber has not been connected");
  }
  return subscriber;
}

export function getSocketAdapterClients(): { pubClient: NodeRedisClient; subClient: NodeRedisClient } | null {
  if (!adapterPubClient || !adapterSubClient) {
    return null;
  }
  return { pubClient: adapterPubClient, subClient: adapterSubClient };
}

export async function checkRedisReady(timeoutMs = 1500): Promise<boolean> {
  try {
    const result = await Promise.race([
      getRedis().ping(),
      new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error("ready timeout")), timeoutMs);
      }),
    ]);
    return result === "PONG";
  } catch {
    return false;
  }
}

export async function closeRedis() {
  closing = true;
  const clients = [...nodeClients];
  nodeClients = [];
  adapterPubClient = null;
  adapterSubClient = null;
  commandClient = null;
  subscriber = null;

  for (const client of clients) {
    try {
      await client.quit();
    } catch {
      try {
        await client.disconnect();
      } catch {
        // Shutdown must continue even if a Redis client is already closed.
      }
    }
  }
}

export function isRedisConfiguredForAdapter() {
  return !env.useMemoryRedis && adapterPubClient !== null && adapterSubClient !== null;
}
