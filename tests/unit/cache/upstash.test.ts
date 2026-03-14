import { describe, expect, it, vi } from "vitest";
import { createUpstashCacheDriver } from "../../../src/cache/upstash.js";

function makeFetch(result: unknown, ok = true): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? "OK" : "Internal Server Error",
    json: async () => ({ result }),
  }) as unknown as typeof globalThis.fetch;
}

const BASE = { url: "https://test.upstash.io", token: "test-token" };

describe("createUpstashCacheDriver", () => {
  describe("get()", () => {
    it("returns parsed value when key exists", async () => {
      const fetchFn = makeFetch(JSON.stringify({ price: 150 }));
      const driver = createUpstashCacheDriver({ ...BASE, fetchFn });
      const result = await driver.get<{ price: number }>("quote:AAPL");
      expect(result).toEqual({ price: 150 });
      expect(fetchFn).toHaveBeenCalledWith(
        "https://test.upstash.io/",
        expect.objectContaining({ method: "POST", body: JSON.stringify(["GET", "quote:AAPL"]) }),
      );
    });

    it("returns undefined when result is null", async () => {
      const driver = createUpstashCacheDriver({ ...BASE, fetchFn: makeFetch(null) });
      expect(await driver.get("missing")).toBeUndefined();
    });

    it("returns undefined when JSON parse fails", async () => {
      const driver = createUpstashCacheDriver({ ...BASE, fetchFn: makeFetch("not-json") });
      expect(await driver.get("bad")).toBeUndefined();
    });
  });

  describe("set()", () => {
    it("sends SET command with EX when ttlSeconds > 0", async () => {
      const fetchFn = makeFetch("OK");
      const driver = createUpstashCacheDriver({ ...BASE, fetchFn });
      await driver.set("quote:AAPL", { price: 150 }, 60);
      expect(fetchFn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(["SET", "quote:AAPL", JSON.stringify({ price: 150 }), "EX", 60]),
        }),
      );
    });

    it("sends SET command without EX when no TTL", async () => {
      const fetchFn = makeFetch("OK");
      const driver = createUpstashCacheDriver({ ...BASE, fetchFn });
      await driver.set("k", "v");
      expect(fetchFn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(["SET", "k", JSON.stringify("v")]),
        }),
      );
    });
  });

  describe("delete()", () => {
    it("sends DEL command", async () => {
      const fetchFn = makeFetch(1);
      const driver = createUpstashCacheDriver({ ...BASE, fetchFn });
      await driver.delete("quote:AAPL");
      expect(fetchFn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ body: JSON.stringify(["DEL", "quote:AAPL"]) }),
      );
    });
  });

  describe("clear()", () => {
    it("sends FLUSHDB command", async () => {
      const fetchFn = makeFetch("OK");
      const driver = createUpstashCacheDriver({ ...BASE, fetchFn });
      await driver.clear();
      expect(fetchFn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ body: JSON.stringify(["FLUSHDB"]) }),
      );
    });
  });

  describe("error handling", () => {
    it("throws on non-ok HTTP response", async () => {
      const driver = createUpstashCacheDriver({ ...BASE, fetchFn: makeFetch(null, false) });
      await expect(driver.get("k")).rejects.toThrow("Upstash REST error:");
    });

    it("throws on Upstash error in JSON response", async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ result: null, error: "WRONGTYPE" }),
      }) as unknown as typeof globalThis.fetch;
      const driver = createUpstashCacheDriver({ ...BASE, fetchFn });
      await expect(driver.get("k")).rejects.toThrow("Upstash: WRONGTYPE");
    });
  });
});
