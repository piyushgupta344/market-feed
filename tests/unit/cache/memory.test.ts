import { describe, expect, it, vi } from "vitest";
import { MemoryCacheDriver } from "../../../src/cache/memory.js";

describe("MemoryCacheDriver", () => {
  it("stores and retrieves a value", async () => {
    const cache = new MemoryCacheDriver();
    await cache.set("key", { price: 100 });
    expect(await cache.get("key")).toEqual({ price: 100 });
  });

  it("returns undefined for missing keys", async () => {
    const cache = new MemoryCacheDriver();
    expect(await cache.get("missing")).toBeUndefined();
  });

  it("expires entries after TTL", async () => {
    vi.useFakeTimers();
    const cache = new MemoryCacheDriver();
    await cache.set("key", "value", 1); // 1 second TTL

    vi.advanceTimersByTime(1001);
    expect(await cache.get("key")).toBeUndefined();
    vi.useRealTimers();
  });

  it("does not expire entries with no TTL", async () => {
    vi.useFakeTimers();
    const cache = new MemoryCacheDriver();
    await cache.set("key", "value"); // no TTL

    vi.advanceTimersByTime(999_999);
    expect(await cache.get("key")).toBe("value");
    vi.useRealTimers();
  });

  it("evicts LRU entry when at capacity", async () => {
    const cache = new MemoryCacheDriver(3);
    await cache.set("a", 1);
    await cache.set("b", 2);
    await cache.set("c", 3);

    // Touch "a" to make it recently used
    await cache.get("a");

    // Insert "d" — should evict "b" (oldest untouched)
    await cache.set("d", 4);

    expect(await cache.get("a")).toBe(1);
    expect(await cache.get("b")).toBeUndefined();
    expect(await cache.get("c")).toBe(3);
    expect(await cache.get("d")).toBe(4);
    expect(cache.size).toBe(3);
  });

  it("deletes a specific entry", async () => {
    const cache = new MemoryCacheDriver();
    await cache.set("key", "value");
    await cache.delete("key");
    expect(await cache.get("key")).toBeUndefined();
  });

  it("clears all entries", async () => {
    const cache = new MemoryCacheDriver();
    await cache.set("a", 1);
    await cache.set("b", 2);
    await cache.clear();
    expect(cache.size).toBe(0);
  });
});
