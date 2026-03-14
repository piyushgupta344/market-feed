import type { CacheDriver } from "./types.js";

// ---------------------------------------------------------------------------
// Upstash REST cache driver
// ---------------------------------------------------------------------------

export interface UpstashCacheOptions {
  /** Upstash Redis REST URL — from Upstash console, e.g. https://xxx.upstash.io */
  url: string;
  /** Upstash REST API token — from Upstash console */
  token: string;
  /**
   * Custom fetch function.
   * Defaults to `globalThis.fetch`.
   * Useful in environments where fetch needs a proxy or polyfill.
   */
  fetchFn?: typeof globalThis.fetch;
}

/**
 * Create a `CacheDriver` backed by Upstash Redis via the REST API.
 *
 * Uses the native `fetch` API — no SDK required. Edge-compatible (Cloudflare
 * Workers, Vercel Edge, Deno Deploy).
 *
 * @example
 * ```ts
 * import { createUpstashCacheDriver } from "market-feed/cache";
 * import { MarketFeed } from "market-feed";
 *
 * const feed = new MarketFeed({
 *   cache: {
 *     driver: createUpstashCacheDriver({
 *       url: process.env.UPSTASH_REDIS_REST_URL!,
 *       token: process.env.UPSTASH_REDIS_REST_TOKEN!,
 *     }),
 *   },
 * });
 * ```
 *
 * @param options - Upstash REST connection options
 */
export function createUpstashCacheDriver(options: UpstashCacheOptions): CacheDriver {
  const { url, token } = options;
  const fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis);

  const baseUrl = url.replace(/\/$/, "");
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  async function exec(command: (string | number)[]): Promise<unknown> {
    const res = await fetchFn(`${baseUrl}/`, {
      method: "POST",
      headers,
      body: JSON.stringify(command),
    });
    if (!res.ok) {
      throw new Error(`Upstash REST error: ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as { result: unknown; error?: string };
    if (json.error) throw new Error(`Upstash: ${json.error}`);
    return json.result;
  }

  return {
    async get<T>(key: string): Promise<T | undefined> {
      const raw = await exec(["GET", key]);
      if (raw == null) return undefined;
      try {
        return JSON.parse(raw as string) as T;
      } catch {
        return undefined;
      }
    },

    async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
      const serialised = JSON.stringify(value);
      if (ttlSeconds !== undefined && ttlSeconds > 0) {
        await exec(["SET", key, serialised, "EX", ttlSeconds]);
      } else {
        await exec(["SET", key, serialised]);
      }
    },

    async delete(key: string): Promise<void> {
      await exec(["DEL", key]);
    },

    async clear(): Promise<void> {
      await exec(["FLUSHDB"]);
    },
  };
}
