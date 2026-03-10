/**
 * Cache configuration example.
 * Shows per-method TTL overrides and custom cache driver.
 *
 * Run: npx tsx examples/with-cache.ts
 */
import { MarketFeed, MemoryCacheDriver } from "../src/index.js";
import type { CacheDriver } from "../src/index.js";

// ── Example 1: Built-in LRU with TTL overrides ─────────────────────────────
const feed = new MarketFeed({
  cache: {
    ttl: 60,          // default: 60s
    maxSize: 1000,    // up to 1000 cached entries
    ttlOverrides: {
      quote: 30,       // quotes expire faster (real-time sensitivity)
      historical: 86400, // historical bars cached for a full day
      company: 604800,   // company profiles change rarely — 1 week
    },
  },
});

const quote = await feed.quote("AAPL");
console.log(`AAPL: $${quote.price.toFixed(2)} (cached for 30s)`);

// Same call — served from cache
const quoteAgain = await feed.quote("AAPL");
console.log(`AAPL (from cache): $${quoteAgain.price.toFixed(2)}`);

// ── Example 2: Custom cache driver (e.g., wrapping Redis) ─────────────────
// Illustrates the CacheDriver interface — swap any storage backend

const inMemoryStore = new Map<string, { value: unknown; expiresAt: number }>();

const customDriver: CacheDriver = {
  async get<T>(key: string): Promise<T | undefined> {
    const entry = inMemoryStore.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
      inMemoryStore.delete(key);
      return undefined;
    }
    return entry.value as T;
  },
  async set<T>(key: string, value: T, ttlSeconds = 60): Promise<void> {
    inMemoryStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  },
  async delete(key: string): Promise<void> {
    inMemoryStore.delete(key);
  },
  async clear(): Promise<void> {
    inMemoryStore.clear();
  },
};

const feedWithCustomCache = new MarketFeed({
  cache: { driver: customDriver },
});

const msft = await feedWithCustomCache.quote("MSFT");
console.log(`MSFT via custom cache: $${msft.price.toFixed(2)}`);
