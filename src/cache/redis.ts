import type { CacheDriver } from "./types.js";

// ---------------------------------------------------------------------------
// Duck-typed Redis client interface
// Matches ioredis, node-redis v4+, and @upstash/redis
// ---------------------------------------------------------------------------

/**
 * Minimal duck-typed interface for a Redis client.
 * Compatible with `ioredis`, `redis` v4+, and `@upstash/redis`.
 */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  /** ioredis: set(key, value, "EX", ttl) | redis@4: set(key, value, { EX: ttl }) */
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  del(key: string | string[]): Promise<unknown>;
  flushdb?(): Promise<unknown>;
  flushDb?(): Promise<unknown>;
}

// ---------------------------------------------------------------------------
// createRedisCacheDriver
// ---------------------------------------------------------------------------

/**
 * Create a `CacheDriver` backed by any Redis-compatible client.
 *
 * Pass an already-connected client — this driver does not manage connections.
 *
 * Compatible with:
 * - [`ioredis`](https://github.com/redis/ioredis) — `new Redis(url)`
 * - [`redis`](https://github.com/redis/node-redis) v4+ — `createClient()`
 * - [`@upstash/redis`](https://github.com/upstash/upstash-redis) — `new Redis({ url, token })`
 *
 * @example ioredis
 * ```ts
 * import Redis from "ioredis";
 * import { createRedisCacheDriver } from "market-feed/cache";
 * import { MarketFeed } from "market-feed";
 *
 * const redis = new Redis(process.env.REDIS_URL);
 * const feed = new MarketFeed({
 *   cache: { driver: createRedisCacheDriver(redis) },
 * });
 * ```
 *
 * @example redis@4
 * ```ts
 * import { createClient } from "redis";
 * import { createRedisCacheDriver } from "market-feed/cache";
 *
 * const client = createClient({ url: process.env.REDIS_URL });
 * await client.connect();
 *
 * const driver = createRedisCacheDriver(client);
 * ```
 *
 * @param client - A connected Redis client
 */
export function createRedisCacheDriver(client: RedisLike): CacheDriver {
  return {
    async get<T>(key: string): Promise<T | undefined> {
      const raw = await client.get(key);
      if (raw == null) return undefined;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return undefined;
      }
    },

    async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
      const serialised = JSON.stringify(value);
      if (ttlSeconds !== undefined && ttlSeconds > 0) {
        // ioredis and redis@4 both accept (key, value, "EX", ttl) positional args
        await client.set(key, serialised, "EX", ttlSeconds);
      } else {
        await client.set(key, serialised);
      }
    },

    async delete(key: string): Promise<void> {
      await client.del(key);
    },

    async clear(): Promise<void> {
      const flush = client.flushdb ?? client.flushDb;
      if (flush) {
        await flush.call(client);
      }
    },
  };
}
