export type RedisSetOptions = {
  px?: number;
  nx?: boolean;
};

export type RedisCommands = {
  eval(script: string, keys: string[], args: string[]): Promise<unknown>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: RedisSetOptions): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
  incr(key: string): Promise<number>;
  decr(key: string): Promise<number>;
  pttl(key: string): Promise<number>;
  pexpire(key: string, milliseconds: number): Promise<number>;
  exists(...keys: string[]): Promise<number>;
  sAdd(key: string, member: string): Promise<number>;
  sRem(key: string, member: string): Promise<number>;
  sMembers(key: string): Promise<string[]>;
  sCard(key: string): Promise<number>;
  zAdd(key: string, score: number, member: string): Promise<number>;
  zRem(key: string, member: string): Promise<number>;
  zRangeByScore(key: string, min: number, max: number, limit: number): Promise<string[]>;
  publish(channel: string, message: string): Promise<number>;
  ping(): Promise<string>;
};

export type RedisSubscriber = {
  subscribe(channel: string, listener: (message: string) => void): Promise<void>;
  unsubscribe(channel: string): Promise<void>;
};

export const RATE_LIMIT_SCRIPT = `
-- sayly:rate-limit
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {count, ttl}
`;

export const CONCURRENCY_ACQUIRE_SCRIPT = `
-- sayly:concurrency-acquire
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
if count > tonumber(ARGV[1]) then
  redis.call('DECR', KEYS[1])
  return 0
end
return 1
`;
