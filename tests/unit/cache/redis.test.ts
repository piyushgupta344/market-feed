import { describe, expect, it, vi } from "vitest";
import { createRedisCacheDriver } from "../../../src/cache/redis.js";
import type { RedisLike } from "../../../src/cache/redis.js";

function makeClient(overrides: Partial<RedisLike> = {}): RedisLike {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    flushdb: vi.fn().mockResolvedValue("OK"),
    ...overrides,
  };
}

describe("createRedisCacheDriver", () => {
  describe("get()", () => {
    it("returns parsed value when key exists", async () => {
      const client = makeClient({ get: vi.fn().mockResolvedValue(JSON.stringify({ price: 150 })) });
      const driver = createRedisCacheDriver(client);
      const result = await driver.get<{ price: number }>("quote:AAPL");
      expect(result).toEqual({ price: 150 });
    });

    it("returns undefined when key does not exist", async () => {
      const client = makeClient({ get: vi.fn().mockResolvedValue(null) });
      const driver = createRedisCacheDriver(client);
      expect(await driver.get("missing")).toBeUndefined();
    });

    it("returns undefined on invalid JSON", async () => {
      const client = makeClient({ get: vi.fn().mockResolvedValue("not-json") });
      const driver = createRedisCacheDriver(client);
      expect(await driver.get("bad")).toBeUndefined();
    });
  });

  describe("set()", () => {
    it("stores serialised value without TTL", async () => {
      const client = makeClient();
      const driver = createRedisCacheDriver(client);
      await driver.set("quote:AAPL", { price: 150 });
      expect(client.set).toHaveBeenCalledWith("quote:AAPL", JSON.stringify({ price: 150 }));
    });

    it("stores value with EX TTL when ttlSeconds > 0", async () => {
      const client = makeClient();
      const driver = createRedisCacheDriver(client);
      await driver.set("quote:AAPL", { price: 150 }, 60);
      expect(client.set).toHaveBeenCalledWith(
        "quote:AAPL",
        JSON.stringify({ price: 150 }),
        "EX",
        60,
      );
    });

    it("omits TTL when ttlSeconds is 0", async () => {
      const client = makeClient();
      const driver = createRedisCacheDriver(client);
      await driver.set("k", "v", 0);
      expect(client.set).toHaveBeenCalledWith("k", JSON.stringify("v"));
    });
  });

  describe("delete()", () => {
    it("calls del with the key", async () => {
      const client = makeClient();
      const driver = createRedisCacheDriver(client);
      await driver.delete("quote:AAPL");
      expect(client.del).toHaveBeenCalledWith("quote:AAPL");
    });
  });

  describe("clear()", () => {
    it("calls flushdb when available (lowercase)", async () => {
      const client = makeClient();
      const driver = createRedisCacheDriver(client);
      await driver.clear();
      expect(client.flushdb).toHaveBeenCalled();
    });

    it("calls flushDb when flushdb is absent", async () => {
      const flushDb = vi.fn().mockResolvedValue("OK");
      const client: RedisLike = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue("OK"),
        del: vi.fn().mockResolvedValue(1),
        flushDb,
      };
      const driver = createRedisCacheDriver(client);
      await driver.clear();
      expect(flushDb).toHaveBeenCalled();
    });

    it("does not throw when no flush method exists", async () => {
      const client: RedisLike = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue("OK"),
        del: vi.fn().mockResolvedValue(1),
      };
      const driver = createRedisCacheDriver(client);
      await expect(driver.clear()).resolves.toBeUndefined();
    });
  });
});
