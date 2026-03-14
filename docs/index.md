---
layout: home

hero:
  name: "market-feed"
  text: "Unified financial market data"
  tagline: One TypeScript client for Yahoo Finance, Alpha Vantage, Polygon.io, Finnhub, Twelve Data, and Tiingo — with caching, fallback, streaming, and React hooks built in.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/piyushgupta344/market-feed

features:
  - icon: 🔌
    title: Six providers, one interface
    details: Yahoo Finance (free), Alpha Vantage, Polygon.io, Finnhub, Twelve Data, and Tiingo. All return the same Quote, HistoricalBar, and CompanyProfile shapes regardless of which provider answers.

  - icon: ⚡
    title: Built-in LRU cache
    details: Responses are cached automatically with smart per-method TTLs. Pluggable driver lets you swap in Redis, Upstash, or any key-value store.

  - icon: 🔄
    title: Automatic failover
    details: Configure a provider chain and market-feed silently tries the next one if the first fails or hits a rate limit — no code changes needed.

  - icon: 📡
    title: Real-time streaming
    details: market-feed/ws delivers tick-by-tick WebSocket trade data from Polygon and Finnhub. market-feed/stream provides market-hours-aware HTTP polling that pauses overnight.

  - icon: 📊
    title: Analysis toolkit
    details: Technical indicators (SMA, EMA, RSI, MACD, Bollinger Bands, ATR, VWAP, Stochastic), portfolio P&L tracking, backtesting engine, price alerts, fundamentals, screener, options chains, and FRED macro indicators — all in one package.

  - icon: ⚛️
    title: React hooks
    details: useQuote, useStream, and useAlerts bring live market data directly into your React components with a single import. Requires React ≥ 18.

  - icon: 🦾
    title: Strict TypeScript
    details: No any. Every response is fully typed with complete autocomplete. Works in Node 20+, Bun, Deno (via JSR), and Cloudflare Workers.

  - icon: 📦
    title: Zero production dependencies
    details: Uses only the native fetch API. Tree-shakable subpath exports — import only what you need. React is an optional peer dependency.
---

## Quickstart

```bash
npm install market-feed
```

```ts
import { MarketFeed } from "market-feed";

const feed = new MarketFeed(); // zero-config — Yahoo Finance, no API key needed

const quote = await feed.quote("AAPL");
console.log(`${quote.symbol}: $${quote.price.toFixed(2)}`);
// AAPL: $189.84
```

That's it. No API keys, no boilerplate.

## Subpath modules

| Import | Description |
|--------|-------------|
| `market-feed` | Core client + all six providers |
| `market-feed/calendar` | Offline exchange calendar for 8 markets + crypto |
| `market-feed/stream` | Market-hours-aware HTTP polling async generator |
| `market-feed/ws` | WebSocket streaming from Polygon / Finnhub |
| `market-feed/consensus` | Parallel multi-provider weighted price consensus |
| `market-feed/indicators` | SMA, EMA, RSI, MACD, Bollinger Bands, ATR, VWAP, Stochastic |
| `market-feed/portfolio` | Live P&L and unrealised gains tracking |
| `market-feed/backtest` | Pure-function backtesting engine |
| `market-feed/alerts` | Price / volume alert async generator |
| `market-feed/fundamentals` | Income statements, balance sheets, cash flows |
| `market-feed/screener` | Filter symbols by price, volume, market cap, and more |
| `market-feed/options` | Options chains with Greeks from Polygon.io |
| `market-feed/macro` | FRED macroeconomic indicators (CPI, GDP, Fed Funds…) |
| `market-feed/react` | `useQuote`, `useStream`, `useAlerts`, `useWebSocket`, `useOrderBook` hooks (React ≥ 18 + React Native) |
| `market-feed/browser` | CORS proxy utilities for browser-side use |
| `market-feed/trpc` | tRPC router + fetch-compatible HTTP handler |
| `market-feed/cache` | Persistent cache drivers: Redis, Upstash, SQLite |
