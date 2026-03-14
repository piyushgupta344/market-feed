import { describe, expect, it, vi } from "vitest";
import { createSqliteCacheDriver } from "../../../src/cache/sqlite.js";
import type { SqliteDatabaseLike, SqliteStatementLike } from "../../../src/cache/sqlite.js";

// ---------------------------------------------------------------------------
// Minimal in-memory SQLite mock
// ---------------------------------------------------------------------------

interface CacheRow {
  value: string;
  expires_at: number;
}

function makeMockDb(): SqliteDatabaseLike {
  const store = new Map<string, CacheRow>();

  function makeStmt(sql: string): SqliteStatementLike {
    return {
      run(...args: unknown[]) {
        if (sql.startsWith("INSERT OR REPLACE")) {
          const [key, value, expires_at] = args as [string, string, number];
          store.set(key, { value, expires_at });
        } else if (sql.startsWith("DELETE FROM market_feed_cache WHERE key")) {
          const [key] = args as [string];
          store.delete(key);
        } else if (sql.startsWith("DELETE FROM market_feed_cache WHERE expires_at")) {
          const [now] = args as [number];
          for (const [k, row] of store) {
            if (row.expires_at > 0 && row.expires_at < now) store.delete(k);
          }
        } else if (sql.startsWith("DELETE FROM market_feed_cache")) {
          store.clear();
        }
      },
      get(...args: unknown[]) {
        const [key] = args as [string];
        return store.get(key) ?? undefined;
      },
    };
  }

  return {
    exec: vi.fn(),
    prepare: vi.fn().mockImplementation(makeStmt),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createSqliteCacheDriver", () => {
  it("creates the table schema on initialisation", () => {
    const db = makeMockDb();
    createSqliteCacheDriver(db);
    expect(db.exec).toHaveBeenCalledOnce();
    // biome-ignore lint/style/noNonNullAssertion: mock was called exactly once per expect above
    expect((db.exec as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toContain(
      "CREATE TABLE IF NOT EXISTS market_feed_cache",
    );
  });

  describe("set() / get()", () => {
    it("stores and retrieves a value without TTL", async () => {
      const driver = createSqliteCacheDriver(makeMockDb());
      await driver.set("quote:AAPL", { price: 150 });
      expect(await driver.get<{ price: number }>("quote:AAPL")).toEqual({ price: 150 });
    });

    it("stores a value with TTL and retrieves it while fresh", async () => {
      const driver = createSqliteCacheDriver(makeMockDb());
      await driver.set("k", "hello", 60);
      expect(await driver.get("k")).toBe("hello");
    });

    it("returns undefined for a missing key", async () => {
      const driver = createSqliteCacheDriver(makeMockDb());
      expect(await driver.get("nonexistent")).toBeUndefined();
    });

    it("evicts and returns undefined for an expired entry", async () => {
      const db = makeMockDb();
      const driver = createSqliteCacheDriver(db);

      // Write directly with an already-expired timestamp
      const stmtSet = db.prepare(
        "INSERT OR REPLACE INTO market_feed_cache (key, value, expires_at) VALUES (?, ?, ?)",
      );
      stmtSet.run("stale", JSON.stringify("old"), Date.now() - 1000);

      expect(await driver.get("stale")).toBeUndefined();
    });

    it("does not evict an entry whose expires_at is 0 (no expiry)", async () => {
      const driver = createSqliteCacheDriver(makeMockDb());
      await driver.set("permanent", "data");
      expect(await driver.get("permanent")).toBe("data");
    });
  });

  describe("delete()", () => {
    it("removes the key", async () => {
      const driver = createSqliteCacheDriver(makeMockDb());
      await driver.set("quote:AAPL", { price: 150 });
      await driver.delete("quote:AAPL");
      expect(await driver.get("quote:AAPL")).toBeUndefined();
    });
  });

  describe("clear()", () => {
    it("removes all entries", async () => {
      const driver = createSqliteCacheDriver(makeMockDb());
      await driver.set("a", 1);
      await driver.set("b", 2);
      await driver.clear();
      expect(await driver.get("a")).toBeUndefined();
      expect(await driver.get("b")).toBeUndefined();
    });
  });
});
