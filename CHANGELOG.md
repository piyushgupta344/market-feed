# market-feed Changelog

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
