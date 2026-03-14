# Roadmap

This page covers what's planned for future releases. Items are roughly ordered by priority, but nothing here is a firm commitment or timeline.

## Recently shipped

- **Polygon fundamentals** — `incomeStatements`, `balanceSheets`, `cashFlows` via `/vX/reference/financials`
- **Tiingo fundamentals** — all three statement types via `/tiingo/fundamentals/{ticker}/statements`
- **Twelve Data fundamentals** — `incomeStatements`, `balanceSheets`, `cashFlows` via `/income_statement`, `/balance_sheet`, `/cash_flow_statement`
- **ESG scores** — `profile.esg.totalScore`, `environmentScore`, `socialScore`, `governanceScore` via Yahoo Finance `esgScores` module
- **Portfolio-level backtesting** — `portfolioBacktest()` with shared cash pool, three position sizing modes, benchmark comparison
- **`market-feed/options`** — options chains with Greeks from Polygon.io (see [Options Chain](/modules/options))
- **`market-feed/macro`** — 15 FRED economic indicator series (see [Macro Indicators](/modules/macro))
- **Screener `volume_vs_avg`** — `volume_vs_avg_above` / `volume_vs_avg_below` criteria
- **Streaming fundamentals** — `includeFundamentals: true` option on `watch()` emits `earnings_released` events when a new quarterly report is detected (see [Stream](/modules/stream))
- **More WebSocket providers** — `AlpacaProvider` (IEX/SIP feed) and `IbTwsProvider` (local TWS/IB Gateway) added to `market-feed/ws` (see [WebSocket Streaming](/modules/ws))
- **Level II order book** — `getOrderBook()` async generator for top-of-book bid/ask updates from Polygon, Alpaca, IB TWS, or polling fallback (see [WebSocket Streaming](/modules/ws#level-ii-order-book))
- **Browser-native bundle** — `market-feed/browser` with CORS proxy utilities (`createFetchWithProxy`, `installCorsProxy`); all providers accept `fetchFn` for proxy routing (see [Browser Bundle](/modules/browser))
- **React Native support** — `useWebSocket` and `useOrderBook` hooks added to `market-feed/react`; all five hooks work with React Native (Expo and bare workflow) with no polyfills needed on RN 0.71+ (see [React Hooks](/modules/react))
- **GraphQL / tRPC adapter** — `market-feed/trpc` exports `createMarketFeedRouter()` (typed procedure router) and `createHttpHandler()` (fetch-compatible REST handler); adapts to tRPC v11, GraphQL resolvers, Next.js, and Cloudflare Workers (see [tRPC / HTTP Router](/modules/trpc))
- **Persistent cache drivers** — `market-feed/cache` ships three drivers: `createRedisCacheDriver` (ioredis/redis@4), `createUpstashCacheDriver` (REST, edge-compatible), `createSqliteCacheDriver` (better-sqlite3/bun:sqlite/node:sqlite) (see [Persistent Cache Drivers](/modules/cache))

## Near-term

---

## Medium-term

---

## Longer-term

---

## Contributing

If you'd like to work on any of the above, open an issue on GitHub to discuss the approach before submitting a PR. Bug fixes and documentation improvements are always welcome without prior discussion.
