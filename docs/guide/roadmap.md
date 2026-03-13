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

## Near-term

---

## Medium-term

---

## Longer-term

### React Native support

Ensure all hooks in `market-feed/react` work in React Native (Hermes engine, no DOM).

### GraphQL / tRPC adapter

A thin adapter layer so market data can be exposed as a typed GraphQL schema or tRPC router:

```ts
import { createMarketFeedRouter } from "market-feed/trpc";

const router = createMarketFeedRouter(feed);
// Exposes: router.quote, router.historical, router.company, etc.
```

### Persistent cache drivers

Official cache driver packages:

- `market-feed-cache-redis` — Redis via `ioredis`
- `market-feed-cache-upstash` — Upstash REST API (edge-compatible)
- `market-feed-cache-sqlite` — SQLite via `better-sqlite3` (local persistence)

---

## Contributing

If you'd like to work on any of the above, open an issue on GitHub to discuss the approach before submitting a PR. Bug fixes and documentation improvements are always welcome without prior discussion.
