# What is market-feed?

**market-feed** is a TypeScript library that provides a unified interface to free financial market data APIs — plus a growing toolkit of analysis and UI utilities built on top of it.

## The problem

Every free financial API speaks a different language:

```ts
// Yahoo Finance
const price = data.chart.result[0].meta.regularMarketPrice;

// Alpha Vantage
const price = parseFloat(data["Global Quote"]["05. price"]);

// Polygon.io
const price = data.ticker.lastTrade.p;
```

Beyond the data shape inconsistencies, you also have to deal with:

- **No caching** — every render or request re-fetches from the provider
- **Rate limits** — Alpha Vantage free tier is 25 calls/day; Polygon is 5 calls/minute
- **No fallback** — if Yahoo's unofficial API is temporarily down, your app breaks
- **Boilerplate** — retry logic, timeout handling, and error normalisation rewritten for every project

## The solution

```ts
import { MarketFeed } from "market-feed";

const feed = new MarketFeed();

const quote = await feed.quote("AAPL");
console.log(quote.price); // always a number, always the same field name
```

One interface. Six providers. Cache, retry, fallback — all built in.

## Design goals

| Goal | How |
|------|-----|
| **Consistent types** | Every provider returns the same `Quote`, `HistoricalBar`, `CompanyProfile` shape |
| **Zero dependencies** | Uses native `fetch` — runs in Node, Bun, Deno, CF Workers without polyfills |
| **Strict TypeScript** | No `any`. Full inference. Works with `strict: true` |
| **Smart defaults** | Works out-of-the-box with Yahoo Finance — no API key required |
| **Transparent** | `raw: true` exposes the original provider response when you need it |
| **Modular** | Sixteen optional subpath modules — import only what you use |

## Beyond the core client

market-feed ships a full analysis toolkit as opt-in subpath modules:

- **[Exchange Calendar](/modules/calendar)** — synchronous, offline-capable session and holiday detection for 8 exchanges + crypto
- **[HTTP Polling Stream](/modules/stream)** — market-hours-aware async generator that pauses overnight and on weekends
- **[WebSocket Streaming](/modules/ws)** — true tick-by-tick trade data from Polygon and Finnhub
- **[Price Consensus](/modules/consensus)** — query all providers in parallel, get a statistically weighted result
- **[Technical Indicators](/modules/indicators)** — SMA, EMA, RSI, MACD, Bollinger Bands, ATR, VWAP, Stochastic
- **[Portfolio](/modules/portfolio)** — track positions and compute live P&L
- **[Backtesting](/modules/backtest)** — test entry/exit strategies against historical data
- **[Price Alerts](/modules/alerts)** — fire events when price, change%, or volume conditions are met
- **[Fundamentals](/modules/fundamentals)** — income statements, balance sheets, cash flow statements
- **[Stock Screener](/modules/screener)** — filter a universe of symbols by any criteria
- **[Options Chain](/modules/options)** — full options chain with Greeks from Polygon.io
- **[Macro Indicators](/modules/macro)** — 15 FRED economic series (CPI, GDP, Fed Funds…)
- **[React Hooks](/modules/react)** — `useQuote`, `useStream`, `useAlerts`, `useWebSocket`, `useOrderBook` for React ≥ 18 and React Native
- **[Browser Bundle](/modules/browser)** — CORS proxy utilities for running market-feed client-side
- **[tRPC / HTTP Router](/modules/trpc)** — expose market data as typed tRPC procedures or a REST API
- **[Persistent Cache Drivers](/modules/cache)** — Redis, Upstash, and SQLite drivers for `market-feed/cache`

## What market-feed is NOT

- A **paid data service** — it wraps free APIs that have rate limits and data delays
- A **trading platform** — the data is for informational use only

::: tip Browser usage
Most financial APIs block CORS requests from browsers. Run market-feed server-side (API routes, server components, edge functions) and pass data to the client. If you need browser-side fetching, `market-feed/browser` provides CORS proxy utilities.
:::
