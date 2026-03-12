/**
 * Minimal interface that any cache backend must implement.
 * Implement this interface to plug in Redis, Upstash, filesystem, etc.
 *
 * @example
 * ```ts
 * import type { CacheDriver } from 'market-feed';
 * import { createClient } from 'redis';
 *
 * const redis = createClient();
 * const driver: CacheDriver = {
 *   async get(key) { const v = await redis.get(key); return v ? JSON.parse(v) : undefined; },
 *   async set(key, value, ttl) { await redis.set(key, JSON.stringify(value), { EX: ttl }); },
 *   async delete(key) { await redis.del(key); },
 *   async clear() { await redis.flushDb(); },
 * };
 * ```
 */
export interface CacheDriver {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface CacheConfig {
  /** Default TTL in seconds for cached responses. Defaults to 60. */
  ttl?: number;
  /** Maximum number of entries in the memory cache. Defaults to 500. */
  maxSize?: number;
  /**
   * Custom cache driver. When provided, `maxSize` is ignored
   * (the driver manages its own eviction).
   */
  driver?: CacheDriver;
  /**
   * Per-method TTL overrides (in seconds).
   * Keys are method names: "quote", "historical", "company", "news", "search", "marketStatus".
   */
  ttlOverrides?: Partial<Record<CacheMethod, number>>;
}

export type CacheMethod =
  | "quote"
  | "historical"
  | "company"
  | "news"
  | "search"
  | "marketStatus"
  | "earnings"
  | "dividends"
  | "splits"
  | "incomeStatements"
  | "balanceSheets"
  | "cashFlows"
  | "optionChain";
