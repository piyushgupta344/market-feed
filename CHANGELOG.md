# market-feed Changelog

## 0.2.0 — 2026-03-11

### New modules

**`market-feed/calendar`** — Synchronous exchange calendar. No network required.
- `isMarketOpen(exchange, at?)` — boolean, DST-correct via `Intl`
- `getSession(exchange, at?)` — `"pre" | "regular" | "post" | "closed"`
- `nextSessionOpen(exchange, from?)` / `nextSessionClose(exchange, from?)` — next UTC Date
- `isHoliday(exchange, date?)` / `isEarlyClose(exchange, date?)` — boolean
- `getHolidayDates(exchange, year)` — all holidays for a given year
- `getExchangeInfo(exchange)` — name, MIC, timezone, open/close times, currency
- Supports: NYSE, NASDAQ, LSE, TSX, ASX, XETRA, NSE, BSE
- Holiday rules computed from first principles (Easter via Meeus/Jones/Butcher algorithm, all US federal/NYSE-specific rules, UK bank holidays, Canadian/Australian/German/Indian holidays)
- Early-close days (NYSE: day before Thanksgiving, Independence Day, Christmas Eve)

**`market-feed/stream`** — Market-hours-aware observable quote stream.
- `watch(feed, symbols, options)` — async generator yielding typed `StreamEvent` union
- Polls at `interval.open` (default 5s) during regular hours, `interval.prepost` (default 30s) pre/post, pauses at `interval.closed` (default 60s) when closed — saves API quota overnight and on weekends
- Emits `market-open` / `market-close` events at session transitions
- Emits `divergence` events when multiple configured providers disagree beyond `divergenceThreshold`
- Graceful `AbortSignal` cancellation
- Configurable `maxErrors` before the generator throws

**`market-feed/consensus`** — Multi-provider parallel price consensus.
- `consensus(providers, symbol, options)` — queries all providers simultaneously via `Promise.allSettled`
- Median-based outlier detection (avoids the all-outlier edge case of mean-based approaches)
- Staleness detection: providers with quotes older than `stalenessThreshold` receive half weight
- Returns `ConsensusResult` with `price`, `confidence` (0–1), `spread`, `spreadPct`, per-provider breakdown, and `flags`
- Flags: `HIGH_DIVERGENCE`, `STALE_DATA`, `SINGLE_SOURCE`, `OUTLIER_EXCLUDED`
- Algorithm helpers exported: `normalizeWeights`, `applyStalenessPenalty`, `weightedMean`, `detectOutliers`, `computeConfidence`

### Breaking changes

None. All v0.1.0 imports continue to work unchanged.

### Other changes

- `MarketFeed` now exposes `get providers(): readonly MarketProvider[]` — read-only view of configured providers, used by `watch()` for divergence detection and `consensus()` for parallel querying
- 78 new unit tests (220 total across 13 test files)
- 4 tsup entry points: `index`, `calendar`, `stream`, `consensus` — each tree-shaken independently

---

## 0.1.0 — 2026-03-10

### Initial release

**Providers**
- `YahooProvider` — Yahoo Finance (no API key required): quote, historical, search, company
- `AlphaVantageProvider` — Alpha Vantage (free: 25/day): quote, historical, search, company
- `PolygonProvider` — Polygon.io (free: 15-min delayed): quote, historical, search, company, news

**Core**
- Unified `Quote`, `HistoricalBar`, `CompanyProfile`, `NewsItem`, `SearchResult`, `MarketStatus` types
- `MarketFeed` client with provider chain, automatic fallback, and LRU caching
- `MemoryCacheDriver` — zero-dependency LRU cache with TTL and configurable max size
- `CacheDriver` interface for plugging in Redis, Upstash, Cloudflare KV, or any store
- `RateLimiter` — token-bucket rate limiter (used internally; also exported for custom providers)
- `HttpClient` — fetch wrapper with exponential-backoff retry and per-request timeout
- Symbol utilities: `normalise`, `stripExchange`, `toYahooSymbol`, `toAlphaVantageSymbol`, `toPolygonSymbol`, `dedupeSymbols`
- Error hierarchy: `MarketFeedError`, `ProviderError`, `RateLimitError`, `UnsupportedOperationError`, `AllProvidersFailedError`

**DX**
- Zero production dependencies (native `fetch` only)
- Strict TypeScript — `strict: true`, `noUncheckedIndexedAccess`, `noImplicitOverride`
- ESM + CJS + `.d.ts` dual build
- Multi-runtime: Node 18+, Bun 1+, Deno 2+, Cloudflare Workers
- 80+ unit tests covering all providers, cache, rate limiter, symbol utils, and error classes
- VitePress documentation site
