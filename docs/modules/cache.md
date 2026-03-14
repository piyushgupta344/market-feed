# Persistent Cache Drivers

`market-feed/cache` ships three official persistent cache drivers as alternatives to the default in-memory LRU cache. Choose the driver that matches your deployment environment.

## Installation

```bash
npm install market-feed
```

No extra packages are needed — the drivers accept any compatible client via duck-typed interfaces.

## Overview

| Driver | Import | Backing store | Edge-compatible |
|--------|--------|---------------|-----------------|
| Redis | `createRedisCacheDriver` | ioredis, redis@4, @upstash/redis | No (requires TCP) |
| Upstash | `createUpstashCacheDriver` | Upstash Redis REST API | Yes |
| SQLite | `createSqliteCacheDriver` | better-sqlite3, bun:sqlite, node:sqlite | No |

All three drivers implement the same `CacheDriver` interface and plug directly into `MarketFeed`:

```ts
import { MarketFeed, YahooProvider } from "market-feed";
import { createRedisCacheDriver } from "market-feed/cache";

const feed = new MarketFeed({
  providers: [new YahooProvider()],
  cache: {
    driver: createRedisCacheDriver(redisClient),
  },
});
```

## Redis driver

Works with [`ioredis`](https://github.com/redis/ioredis), [`redis`](https://github.com/redis/node-redis) v4+, and [`@upstash/redis`](https://github.com/upstash/upstash-redis) via duck-typing — no specific package required.

### ioredis

```ts
import Redis from "ioredis";
import { MarketFeed, YahooProvider } from "market-feed";
import { createRedisCacheDriver } from "market-feed/cache";

const redis = new Redis(process.env.REDIS_URL);

const feed = new MarketFeed({
  providers: [new YahooProvider()],
  cache: { driver: createRedisCacheDriver(redis) },
});
```

### redis@4 (node-redis)

```ts
import { createClient } from "redis";
import { createRedisCacheDriver } from "market-feed/cache";

const client = createClient({ url: process.env.REDIS_URL });
await client.connect();

const driver = createRedisCacheDriver(client);
```

### TTL behaviour

When a TTL is provided, the driver calls `set(key, value, "EX", ttlSeconds)` using positional arguments — compatible with both ioredis and redis@4 positional syntax.

### `RedisLike` interface

If you have a custom Redis-compatible client, implement this minimal interface:

```ts
interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  del(key: string | string[]): Promise<unknown>;
  flushdb?(): Promise<unknown>;  // lowercase (ioredis)
  flushDb?(): Promise<unknown>;  // camelCase (redis@4)
}
```

## Upstash driver

Uses the [Upstash Redis REST API](https://upstash.com) via `fetch` — no SDK or TCP connection required. Runs everywhere `fetch` is available, including Cloudflare Workers, Vercel Edge, Deno Deploy, and browsers.

```ts
import { MarketFeed, YahooProvider } from "market-feed";
import { createUpstashCacheDriver } from "market-feed/cache";

const feed = new MarketFeed({
  providers: [new YahooProvider()],
  cache: {
    driver: createUpstashCacheDriver({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    }),
  },
});
```

### Options

```ts
interface UpstashCacheOptions {
  url: string;      // Upstash Redis REST URL from console
  token: string;    // Upstash REST API token from console
  fetchFn?: typeof globalThis.fetch;  // optional custom fetch
}
```

### Custom fetch (CORS proxy / polyfill)

```ts
import { createFetchWithProxy } from "market-feed/browser";
import { createUpstashCacheDriver } from "market-feed/cache";

const driver = createUpstashCacheDriver({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  fetchFn: createFetchWithProxy("https://my-proxy.example.com/?url="),
});
```

## SQLite driver

Persistent local cache backed by a SQLite database. Uses synchronous DB operations (like `better-sqlite3`) wrapped in async `CacheDriver` methods.

Compatible with:
- [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3)
- `bun:sqlite` (Bun built-in)
- `node:sqlite` / `DatabaseSync` (Node 22+)

### better-sqlite3

```ts
import Database from "better-sqlite3";
import { MarketFeed, YahooProvider } from "market-feed";
import { createSqliteCacheDriver } from "market-feed/cache";

const db = new Database("./market-data.db");

const feed = new MarketFeed({
  providers: [new YahooProvider()],
  cache: { driver: createSqliteCacheDriver(db) },
});
```

### bun:sqlite

```ts
import { Database } from "bun:sqlite";
import { createSqliteCacheDriver } from "market-feed/cache";

const db = new Database("./market-data.db");
const driver = createSqliteCacheDriver(db);
```

### node:sqlite (Node 22+)

```ts
import { DatabaseSync } from "node:sqlite";
import { createSqliteCacheDriver } from "market-feed/cache";

const db = new DatabaseSync("./market-data.db");
const driver = createSqliteCacheDriver(db);
```

### Table schema

The driver creates the following table on first use (DDL is idempotent):

```sql
CREATE TABLE IF NOT EXISTS market_feed_cache (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  expires_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_market_feed_cache_expires
  ON market_feed_cache (expires_at)
  WHERE expires_at > 0;
```

The `expires_at` column stores milliseconds since epoch. `0` means no expiry. Expired entries are evicted lazily on read, with opportunistic batch cleanup occurring on ~1% of writes.

### `SqliteDatabaseLike` interface

```ts
interface SqliteStatementLike {
  run(...args: unknown[]): unknown;
  get(...args: unknown[]): unknown;
}

interface SqliteDatabaseLike {
  prepare(sql: string): SqliteStatementLike;
  exec(sql: string): void;
}
```

## Combining with custom TTLs

Override default TTLs per endpoint when creating `MarketFeed`:

```ts
const feed = new MarketFeed({
  providers: [new YahooProvider()],
  cache: {
    driver: createRedisCacheDriver(redis),
    ttl: {
      quote: 30,         // 30s (default 60s)
      historical: 7200,  // 2h  (default 1h)
      company: 172800,   // 48h (default 24h)
    },
  },
});
```

## Writing a custom driver

Any object that implements `CacheDriver` works:

```ts
import type { CacheDriver } from "market-feed/cache";

const myDriver: CacheDriver = {
  async get<T>(key: string): Promise<T | undefined> { /* ... */ },
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> { /* ... */ },
  async delete(key: string): Promise<void> { /* ... */ },
  async clear(): Promise<void> { /* ... */ },
};
```

See the [Custom Cache Driver](/guide/custom-cache) guide for a full walkthrough.
