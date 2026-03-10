# Caching

market-feed ships with a zero-config LRU cache. Responses are stored in memory with per-method TTLs so repeated calls don't hammer the provider.

## Default behaviour

By default, every `MarketFeed` instance creates an in-memory LRU cache with these TTLs:

| Method | Default TTL | Rationale |
|--------|------------|-----------|
| `quote` | 60 seconds | Prices change frequently |
| `historical` | 1 hour | OHLCV bars rarely change once closed |
| `company` | 24 hours | Company profiles change rarely |
| `news` | 5 minutes | News should feel somewhat fresh |
| `search` | 10 minutes | Search results are stable short-term |
| `marketStatus` | 60 seconds | Market hours change infrequently |

## Configuration

```ts
const feed = new MarketFeed({
  cache: {
    ttl: 60,        // default TTL for any method not overridden
    maxSize: 1000,  // max number of entries in memory (default: 500)
  },
});
```

## Per-method TTL overrides

```ts
const feed = new MarketFeed({
  cache: {
    ttl: 60,
    ttlOverrides: {
      quote: 15,           // aggressive refresh for real-time feel
      historical: 86400,   // historical bars cached for a full day
      company: 604800,     // company profiles — 1 week
      news: 120,           // news — 2 minutes
    },
  },
});
```

## Disable caching entirely

```ts
const feed = new MarketFeed({ cache: false });
```

## Manual cache invalidation

```ts
// Clear all cached entries
await feed.clearCache();

// Invalidate a specific cache key
await feed.invalidate("quote:AAPL");
```

## Custom cache driver

The `CacheDriver` interface lets you use any storage backend:

```ts
interface CacheDriver {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}
```

### Redis example

```ts
import { createClient } from "redis";
import type { CacheDriver } from "market-feed";

const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

const redisDriver: CacheDriver = {
  async get<T>(key: string) {
    const val = await redis.get(key);
    return val ? (JSON.parse(val) as T) : undefined;
  },
  async set<T>(key: string, value: T, ttl = 60) {
    await redis.set(key, JSON.stringify(value), { EX: ttl });
  },
  async delete(key: string) {
    await redis.del(key);
  },
  async clear() {
    await redis.flushDb();
  },
};

const feed = new MarketFeed({
  cache: { driver: redisDriver },
});
```

### Upstash Redis example

```ts
import { Redis } from "@upstash/redis";
import type { CacheDriver } from "market-feed";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const upstashDriver: CacheDriver = {
  async get<T>(key: string) {
    return redis.get<T>(key) ?? undefined;
  },
  async set<T>(key: string, value: T, ttl = 60) {
    await redis.set(key, value, { ex: ttl });
  },
  async delete(key: string) {
    await redis.del(key);
  },
  async clear() {
    await redis.flushdb();
  },
};

const feed = new MarketFeed({
  cache: { driver: upstashDriver },
});
```

::: tip Cloudflare Workers / Edge
For edge environments, use Upstash Redis (HTTP-based) or a KV namespace driver. Both work without persistent Node.js connections.
:::

## Cache key format

Keys follow this pattern so you can predict and invalidate them:

| Method | Key pattern |
|--------|-------------|
| `quote` | `quote:AAPL` or `quote:AAPL,MSFT,GOOGL` |
| `historical` | `historical:AAPL:1d:2024-01-01:2024-12-31` |
| `company` | `company:AAPL` |
| `news` | `news:AAPL:10` |
| `search` | `search:Apple:10` |
| `marketStatus` | `marketStatus:US` |
