# Custom Cache Driver

The `CacheDriver` interface is small and simple — implement it to use any storage backend.

## Interface

```ts
interface CacheDriver {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}
```

## Vercel KV (Upstash)

```ts
import { kv } from "@vercel/kv";
import type { CacheDriver } from "market-feed";

const vercelKVDriver: CacheDriver = {
  async get<T>(key: string) {
    return (await kv.get<T>(key)) ?? undefined;
  },
  async set<T>(key: string, value: T, ttl = 60) {
    await kv.set(key, value, { ex: ttl });
  },
  async delete(key: string) {
    await kv.del(key);
  },
  async clear() {
    await kv.flushdb();
  },
};
```

## Cloudflare KV

```ts
// Assumes KV namespace is bound as `MY_KV` in the Worker
import type { CacheDriver } from "market-feed";

function cloudflareKVDriver(kv: KVNamespace): CacheDriver {
  return {
    async get<T>(key: string) {
      const val = await kv.get(key, "json");
      return val as T | undefined;
    },
    async set<T>(key: string, value: T, ttl = 60) {
      await kv.put(key, JSON.stringify(value), { expirationTtl: ttl });
    },
    async delete(key: string) {
      await kv.delete(key);
    },
    async clear() {
      // KV doesn't support bulk delete — list and delete
      const list = await kv.list();
      await Promise.all(list.keys.map(k => kv.delete(k.name)));
    },
  };
}
```

## In-memory with node-cache

```ts
import NodeCache from "node-cache";
import type { CacheDriver } from "market-feed";

const nodeCache = new NodeCache();

const nodeCacheDriver: CacheDriver = {
  async get<T>(key: string) {
    return nodeCache.get<T>(key);
  },
  async set<T>(key: string, value: T, ttl = 60) {
    nodeCache.set(key, value, ttl);
  },
  async delete(key: string) {
    nodeCache.del(key);
  },
  async clear() {
    nodeCache.flushAll();
  },
};
```

## Using your driver

```ts
import { MarketFeed } from "market-feed";

const feed = new MarketFeed({
  cache: {
    driver: redisDriver,
    // ttlOverrides still work with custom drivers
    ttlOverrides: {
      quote: 30,
      company: 86400,
    },
  },
});
```

::: tip
When a custom `driver` is provided, `maxSize` has no effect — the driver manages its own eviction policy.
:::
