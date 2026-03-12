# Roadmap

This page covers what's planned for future releases. Items are roughly ordered by priority, but nothing here is a firm commitment or timeline.

## Recently shipped

- **Polygon fundamentals** — `incomeStatements`, `balanceSheets`, `cashFlows` via `/vX/reference/financials`
- **Tiingo fundamentals** — all three statement types via `/tiingo/fundamentals/{ticker}/statements`
- **Twelve Data fundamentals** — `incomeStatements`, `balanceSheets`, `cashFlows` via `/income_statement`, `/balance_sheet`, `/cash_flow_statement`
- **ESG scores** — `profile.esg.totalScore`, `environmentScore`, `socialScore`, `governanceScore` via Yahoo Finance `esgScores` module
- **`market-feed/options`** — options chains with Greeks from Polygon.io (see [Options Chain](/modules/options))
- **`market-feed/macro`** — 15 FRED economic indicator series (see [Macro Indicators](/modules/macro))
- **Screener `volume_vs_avg`** — `volume_vs_avg_above` / `volume_vs_avg_below` criteria

## Near-term

---

## Medium-term

### Portfolio-level backtesting

The current `backtest()` function is single-asset only. A multi-asset engine is planned:

- Multiple positions open simultaneously
- Position sizing (fixed dollar, percent of equity, Kelly criterion)
- Correlation-aware max drawdown
- Benchmark comparison (SPY, QQQ)

### Streaming fundamentals

Combine the `watch()` stream with fundamentals to emit events when quarterly reports are published:

```ts
for await (const ev of watch(feed, ["AAPL"], { includeFundamentals: true })) {
  if (ev.type === "earnings_released") {
    console.log(ev.symbol, ev.eps, ev.revenueActual);
  }
}
```

### More WebSocket providers

The `market-feed/ws` module currently supports Polygon.io and Finnhub. Planned additions:

- **Alpaca** — commission-free brokerage with real-time data WebSocket
- **Interactive Brokers TWS** — institutional-grade level II data

### Level II order book

```ts
import { getOrderBook } from "market-feed/ws";

for await (const update of getOrderBook(feed, "AAPL")) {
  console.log(update.bids[0], update.asks[0]);
}
```

---

## Longer-term

### Browser-native bundle

A separate `market-feed/browser` build without Node.js dependencies (no `ws` package), suitable for direct use in the browser without a bundler.

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
