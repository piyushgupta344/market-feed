import type { CacheDriver } from "./types.js";

interface Entry<T> {
  value: T;
  expiresAt: number; // epoch ms, 0 = no expiry
}

/**
 * A simple LRU (Least-Recently-Used) in-memory cache with TTL support.
 * No dependencies — uses a Map for O(1) access and insertion-order eviction.
 */
export class MemoryCacheDriver implements CacheDriver {
  private readonly store = new Map<string, Entry<unknown>>();
  private readonly maxSize: number;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.store.get(key) as Entry<T> | undefined;
    if (!entry) return undefined;

    // Evict expired entries on read
    if (entry.expiresAt !== 0 && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    // LRU: move to end (most recently used)
    this.store.delete(key);
    this.store.set(key, entry);

    return entry.value;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    // Evict the oldest entry if at capacity
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) {
        this.store.delete(oldest);
      }
    }

    const expiresAt =
      ttlSeconds !== undefined && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1_000 : 0;

    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  /** Current number of cached entries (including potentially expired ones). */
  get size(): number {
    return this.store.size;
  }
}
