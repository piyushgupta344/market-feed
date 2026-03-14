import type { CacheDriver } from "./types.js";

// ---------------------------------------------------------------------------
// Duck-typed SQLite interface
// Compatible with better-sqlite3, bun:sqlite, node:sqlite (Node 22+)
// ---------------------------------------------------------------------------

/**
 * Minimal duck-typed prepared statement interface.
 * Compatible with `better-sqlite3`, `bun:sqlite`, and `node:sqlite`.
 */
export interface SqliteStatementLike {
  run(...args: unknown[]): unknown;
  get(...args: unknown[]): unknown;
  all?(...args: unknown[]): unknown[];
}

/**
 * Minimal duck-typed SQLite database interface.
 * Compatible with `better-sqlite3`, `bun:sqlite`, and `node:sqlite`.
 */
export interface SqliteDatabaseLike {
  prepare(sql: string): SqliteStatementLike;
  exec(sql: string): void;
}

const TABLE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS market_feed_cache (
    key       TEXT PRIMARY KEY,
    value     TEXT NOT NULL,
    expires_at INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_market_feed_cache_expires
    ON market_feed_cache (expires_at)
    WHERE expires_at > 0;
`;

/**
 * Create a `CacheDriver` backed by a SQLite database.
 *
 * Creates a `market_feed_cache` table on first use (if it doesn't already
 * exist). Expired entries are evicted lazily on read.
 *
 * Compatible with:
 * - [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) — `new Database(path)`
 * - `bun:sqlite` — `new Database(path)` (synchronous API)
 * - `node:sqlite` — `new DatabaseSync(path)` (Node 22+)
 *
 * @example better-sqlite3
 * ```ts
 * import Database from "better-sqlite3";
 * import { createSqliteCacheDriver } from "market-feed/cache";
 * import { MarketFeed } from "market-feed";
 *
 * const db = new Database("./market-data.db");
 * const feed = new MarketFeed({
 *   cache: { driver: createSqliteCacheDriver(db) },
 * });
 * ```
 *
 * @example bun:sqlite
 * ```ts
 * import { Database } from "bun:sqlite";
 * import { createSqliteCacheDriver } from "market-feed/cache";
 *
 * const db = new Database("./market-data.db");
 * const driver = createSqliteCacheDriver(db);
 * ```
 *
 * @param db - An open SQLite database instance
 */
export function createSqliteCacheDriver(db: SqliteDatabaseLike): CacheDriver {
  // Create table and index on first call (synchronous DDL)
  db.exec(TABLE_SCHEMA);

  const stmtGet = db.prepare("SELECT value, expires_at FROM market_feed_cache WHERE key = ?");
  const stmtSet = db.prepare(
    "INSERT OR REPLACE INTO market_feed_cache (key, value, expires_at) VALUES (?, ?, ?)",
  );
  const stmtDel = db.prepare("DELETE FROM market_feed_cache WHERE key = ?");
  const stmtClear = db.prepare("DELETE FROM market_feed_cache");
  const stmtExpire = db.prepare(
    "DELETE FROM market_feed_cache WHERE expires_at > 0 AND expires_at < ?",
  );

  return {
    async get<T>(key: string): Promise<T | undefined> {
      const now = Date.now();
      const row = stmtGet.get(key) as { value: string; expires_at: number } | undefined;

      if (!row) return undefined;

      // Evict on read
      if (row.expires_at > 0 && now > row.expires_at) {
        stmtDel.run(key);
        return undefined;
      }

      try {
        return JSON.parse(row.value) as T;
      } catch {
        return undefined;
      }
    },

    async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
      const serialised = JSON.stringify(value);
      const expiresAt =
        ttlSeconds !== undefined && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1_000 : 0;
      stmtSet.run(key, serialised, expiresAt);

      // Opportunistic cleanup of expired entries (~1% of writes)
      if (Math.random() < 0.01) {
        stmtExpire.run(Date.now());
      }
    },

    async delete(key: string): Promise<void> {
      stmtDel.run(key);
    },

    async clear(): Promise<void> {
      stmtClear.run();
    },
  };
}
