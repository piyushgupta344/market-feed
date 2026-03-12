# market-feed

> Unified TypeScript client for financial market data.
> Wraps Yahoo Finance, Alpha Vantage, Polygon.io, Finnhub, Twelve Data, and Tiingo under one consistent interface — with caching and automatic fallback built in.

[![CI](https://github.com/piyushgupta344/market-feed/actions/workflows/ci.yml/badge.svg)](https://github.com/piyushgupta344/market-feed/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/market-feed.svg)](https://www.npmjs.com/package/market-feed)
[![npm downloads](https://img.shields.io/npm/dm/market-feed)](https://www.npmjs.com/package/market-feed)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](tsconfig.json)

---

## The problem

Every free financial API speaks a different language:

```ts
// Yahoo Finance
result.chart.result[0].meta.regularMarketPrice

// Alpha Vantage
data["Global Quote"]["05. price"]

// Polygon.io
data.ticker.lastTrade.p
```

You write adapters, you add caching, you handle fallback — for every project, every time.

## The solution

```ts
import { MarketFeed } from "market-feed";

const feed = new MarketFeed();
const quote = await feed.quote("AAPL");

console.log(quote.price); // always a number, always the same key
```

One interface. Six providers. Zero API key required for Yahoo Finance.

---

## Features

- **Unified types** — `Quote`, `HistoricalBar`, `CompanyProfile`, `NewsItem`, `SearchResult` are consistent regardless of which provider answers
- **Zero production dependencies** — uses native `fetch`, works everywhere
- **Built-in LRU cache** — configurable TTL per method, pluggable driver (Redis, Upstash, etc.)
- **Automatic fallback** — if Yahoo is down, tries Alpha Vantage, then Polygon
- **Rate-limit aware** — won't silently burn your free Alpha Vantage / Polygon quota
- **Strict TypeScript** — no `any`, full autocomplete, compile-time safety
- **Multi-runtime** — Node 18+, Bun 1+, Deno 2+, Cloudflare Workers
- **Escape hatch** — pass `{ raw: true }` to get the original provider response
- **Exchange calendar** — synchronous, offline-capable holiday and session detection for 8 exchanges + crypto (24/7)
- **WebSocket streaming** — `market-feed/ws` opens a persistent WS connection to Polygon or Finnhub; polling fallback for Yahoo/AV
- **Observable stream** — market-hours-aware HTTP polling that pauses overnight and on weekends
- **Price consensus** — query all providers in parallel, get a weighted mean with confidence score
- **Technical indicators** — SMA, EMA, RSI, MACD, Bollinger Bands, ATR, VWAP, Stochastic — pure functions, zero deps
- **Portfolio tracking** — live P&L, unrealised gains, day change across all positions
- **Backtesting** — pure-function engine: total return, CAGR, Sharpe ratio, max drawdown, win rate, profit factor
- **Price alerts** — async generator that fires `AlertEvent` on price/volume/change conditions, with debounce
- **Earnings, dividends, splits** — structured historical corporate action data from Yahoo, Polygon, and Finnhub
- **Financial statements** — income statement, balance sheet, and cash flow statement via `market-feed/fundamentals`
- **Stock screener** — filter a universe of symbols by price, volume, market cap, 52-week range, or any custom predicate via `market-feed/screener`
- **React hooks** — `useQuote`, `useStream`, `useAlerts` for React ≥ 18 via `market-feed/react`
- **CLI** — `npx market-feed quote AAPL` — no install required
- **Crypto & Forex** — `isCrypto()` / `isForex()` helpers, CRYPTO calendar exchange (always open)

---

## Subpath modules

`market-feed` ships eleven optional subpath modules alongside the core client.

### `market-feed/ws`

True WebSocket streaming — tick-by-tick trade data from Polygon and Finnhub, with automatic polling fallback for other providers.

```ts
import { connect } from "market-feed/ws";
import { MarketFeed, FinnhubProvider, PolygonProvider } from "market-feed";

// Finnhub — real-time WebSocket
const provider = new FinnhubProvider({ apiKey: process.env.FINNHUB_KEY! });

// Polygon — real-time WebSocket (requires paid plan for true real-time)
// const provider = new PolygonProvider({ apiKey: process.env.POLYGON_KEY! });

const controller = new AbortController();

for await (const event of connect(provider, ["AAPL", "MSFT", "TSLA"], {
  signal: controller.signal,
})) {
  switch (event.type) {
    case "trade":
      console.log(`${event.trade.symbol}: $${event.trade.price} × ${event.trade.size} shares`);
      break;
    case "connected":
      console.log(`Connected to ${event.provider}`);
      break;
    case "disconnected":
      console.log(`Disconnected (attempt ${event.attempt}, reconnecting: ${event.reconnecting})`);
      break;
    case "error":
      if (!event.recoverable) throw event.error;
      break;
  }
}

controller.abort(); // stop the stream
```

Unlike `market-feed/stream` (which is HTTP polling), `market-feed/ws` opens a persistent WebSocket connection and yields individual trade executions in real time.

#### Provider support

| Provider | WebSocket | Notes |
|----------|-----------|-------|
| `PolygonProvider` | Native WS | Auth via JSON handshake, subscribes to `T.*` trades |
| `FinnhubProvider` | Native WS | Token in URL, per-symbol subscribe |
| `YahooProvider` | Polling fallback | Polls `quote()` every 5 s |
| `AlphaVantageProvider` | Polling fallback | Same as Yahoo |

#### `WsOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `wsImpl` | `typeof WebSocket` | `globalThis.WebSocket` | Custom WS constructor for Node 18–20 |
| `maxReconnectAttempts` | `number` | `10` | Reconnects before closing |
| `reconnectDelayMs` | `number` | `1000` | Base delay (doubles per attempt, max 30 s) |
| `signal` | `AbortSignal` | — | Stop the stream |

#### Node 18–20

Node 21+, Bun, Deno, and Cloudflare Workers expose `WebSocket` globally. For Node 18–20, install the `ws` package and inject it:

```ts
import WebSocket from "ws";
connect(provider, ["AAPL"], { wsImpl: WebSocket as unknown as typeof globalThis.WebSocket })
```

---

### `market-feed/calendar`

Synchronous exchange calendar — no network, no async, works offline.

```ts
import {
  isMarketOpen,
  getSession,
  nextSessionOpen,
  nextSessionClose,
  isHoliday,
  isEarlyClose,
  getHolidayDates,
  getExchangeInfo,
} from "market-feed/calendar";

// Is NYSE open right now?
isMarketOpen("NYSE");  // true | false

// What session is it?
getSession("NYSE");    // "pre" | "regular" | "post" | "closed"

// When does it next open?
nextSessionOpen("NYSE");   // Date (UTC)
nextSessionClose("NYSE");  // Date (UTC)

// Holiday checks
isHoliday("LSE");                          // false
isHoliday("NYSE", new Date("2025-04-18")); // true — Good Friday
isEarlyClose("NYSE");                      // true on day before Thanksgiving

// All holidays for a year
getHolidayDates("NYSE", 2026);  // Date[]

// Exchange metadata
getExchangeInfo("LSE");
// { id: "LSE", name: "London Stock Exchange", mic: "XLON",
//   timezone: "Europe/London", openTime: "08:00", closeTime: "16:30", ... }
```

Supports **NYSE, NASDAQ, LSE, TSX, ASX, XETRA, NSE, BSE**, and **CRYPTO** (always open — no sessions, no holidays). Holiday rules are computed from first principles — Easter via the Meeus/Jones/Butcher algorithm, all NYSE-specific rules (MLK Day, Presidents' Day, Juneteenth, Memorial Day, Labor Day, Thanksgiving, Good Friday), UK bank holidays, Canadian, Australian, German, and Indian exchanges. DST is handled via `Intl.DateTimeFormat` — no manual offset arithmetic.

---

### `market-feed/stream`

Market-hours-aware async generator. Polls during open hours, pauses when the market is closed.

```ts
import { watch } from "market-feed/stream";
import { MarketFeed, YahooProvider, PolygonProvider } from "market-feed";

const feed = new MarketFeed({
  providers: [
    new YahooProvider(),
    new PolygonProvider({ apiKey: process.env.POLYGON_KEY }),
  ],
});

const controller = new AbortController();

for await (const event of watch(feed, ["AAPL", "MSFT"], {
  exchange: "NYSE",
  interval: {
    open:    5_000,   // poll every 5s during regular hours
    prepost: 30_000,  // every 30s pre/post market
    closed:  60_000,  // check every 60s for session open
  },
  divergenceThreshold: 0.5,  // % spread between providers
  signal: controller.signal,
})) {
  switch (event.type) {
    case "quote":
      console.log(`${event.symbol}: $${event.quote.price}`);
      break;
    case "market-open":
      console.log(`${event.exchange} session started: ${event.session}`);
      break;
    case "market-close":
      console.log(`${event.exchange} session ended`);
      break;
    case "divergence":
      console.log(`${event.symbol} providers disagree: ${event.spreadPct.toFixed(2)}%`);
      break;
    case "error":
      if (!event.recoverable) throw event.error;
      break;
  }
}

// Stop the stream
controller.abort();
```

When `marketHoursAware: true` (default), the stream pauses completely during closed sessions — no wasted API calls overnight or on weekends. It emits `market-open` / `market-close` events at session boundaries. When the feed has multiple providers, it detects price divergence across them and emits `divergence` events.

#### `WatchOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `exchange` | `ExchangeId` | `"NYSE"` | Calendar to use for session detection |
| `interval.open` | `number` | `5000` | Poll interval (ms) during regular hours |
| `interval.prepost` | `number` | `30000` | Poll interval (ms) during pre/post market |
| `interval.closed` | `number` | `60000` | Check interval (ms) when market is closed |
| `marketHoursAware` | `boolean` | `true` | Pause during closed sessions |
| `divergenceThreshold` | `number` | `0.5` | % spread that triggers a divergence event |
| `maxErrors` | `number` | `5` | Consecutive errors before the generator throws |
| `signal` | `AbortSignal` | — | Cancel the stream |

---

### `market-feed/consensus`

Queries all configured providers simultaneously and returns a statistically-weighted price consensus.

Unlike `feed.quote()` which stops at the first successful provider, `consensus()` fires all providers in parallel and combines their results.

```ts
import { consensus } from "market-feed/consensus";
import { MarketFeed, YahooProvider, AlphaVantageProvider, PolygonProvider } from "market-feed";

const feed = new MarketFeed({
  providers: [
    new YahooProvider(),
    new AlphaVantageProvider({ apiKey: process.env.AV_KEY }),
    new PolygonProvider({ apiKey: process.env.POLYGON_KEY }),
  ],
});

const result = await consensus(feed.providers, "AAPL");

console.log(result.price);       // 189.82 — weighted mean
console.log(result.confidence);  // 0.97   — 0=no agreement, 1=perfect
console.log(result.spread);      // 0.08   — max - min across providers
console.log(result.spreadPct);   // 0.042  — spread as % of price
console.log(result.flags);       // [] or ["HIGH_DIVERGENCE", "STALE_DATA", ...]
console.log(result.providers);
// {
//   yahoo:          { price: 189.84, weight: 0.33, stale: false, included: true },
//   polygon:        { price: 189.80, weight: 0.33, stale: false, included: true },
//   "alpha-vantage": { price: 189.82, weight: 0.33, stale: false, included: true },
// }
```

#### `ConsensusOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `stalenessThreshold` | `number` | `60` | Seconds before a quote is stale. Stale providers get half weight. |
| `divergenceThreshold` | `number` | `2.0` | % deviation from median that marks a provider as an outlier |
| `weights` | `Record<string, number>` | equal | Custom weights per provider name (normalized automatically) |

#### Flags

| Flag | Meaning |
|------|---------|
| `HIGH_DIVERGENCE` | `spreadPct` exceeds `divergenceThreshold` |
| `STALE_DATA` | At least one provider returned a quote older than `stalenessThreshold` |
| `SINGLE_SOURCE` | Only one provider responded successfully |
| `OUTLIER_EXCLUDED` | At least one provider was excluded as a price outlier |

---

### `market-feed/indicators`

Technical indicators as pure functions over `HistoricalBar[]`. No network, no async, tree-shakeable.

```ts
import {
  sma, ema, rsi, macd, bollingerBands, atr, vwap, stochastic,
} from "market-feed/indicators";
import { MarketFeed } from "market-feed";

const feed = new MarketFeed();
const bars = await feed.historical("AAPL", { period1: "2024-01-01", interval: "1d" });

// Simple / Exponential Moving Average
const sma20  = sma(bars, 20);   // IndicatorPoint[] — { date, value }[]
const ema12  = ema(bars, 12);

// Relative Strength Index
const rsi14  = rsi(bars, 14);   // values in [0, 100]

// MACD
const macdResult = macd(bars);  // MACDPoint[] — { date, macd, signal, histogram }[]

// Bollinger Bands
const bb = bollingerBands(bars, 20, 2);  // BollingerPoint[] — { date, upper, middle, lower }[]

// Average True Range
const atr14 = atr(bars, 14);

// VWAP (cumulative from first bar)
const vwapPoints = vwap(bars);

// Stochastic Oscillator
const stoch = stochastic(bars, 14, 3);  // StochasticPoint[] — { date, k, d }[]
```

All functions return typed arrays starting from the first bar where enough data exists. They never throw for insufficient data — they return an empty array instead.

| Function | Output type | Default params |
|----------|------------|----------------|
| `sma(bars, period)` | `IndicatorPoint[]` | — |
| `ema(bars, period)` | `IndicatorPoint[]` | — |
| `rsi(bars, period?)` | `IndicatorPoint[]` | period: 14 |
| `macd(bars, fast?, slow?, signal?)` | `MACDPoint[]` | 12, 26, 9 |
| `bollingerBands(bars, period?, stdDevMult?)` | `BollingerPoint[]` | 20, 2 |
| `atr(bars, period?)` | `IndicatorPoint[]` | period: 14 |
| `vwap(bars)` | `IndicatorPoint[]` | — |
| `stochastic(bars, kPeriod?, dPeriod?)` | `StochasticPoint[]` | 14, 3 |

---

### `market-feed/portfolio`

Track a collection of positions and compute live P&L against current market prices.

```ts
import { Portfolio } from "market-feed/portfolio";
import { MarketFeed } from "market-feed";

const feed = new MarketFeed();

const portfolio = new Portfolio([
  { symbol: "AAPL", quantity: 10, avgCost: 150.00 },
  { symbol: "MSFT", quantity:  5, avgCost: 280.00 },
  { symbol: "TSLA", quantity: -3, avgCost: 250.00 }, // short position
]);

// Fetch live quotes and compute P&L in one call
const snap = await portfolio.snapshot(feed);

console.log(`Total value:       $${snap.totalMarketValue.toFixed(2)}`);
console.log(`Unrealised P&L:    $${snap.totalUnrealizedPnl.toFixed(2)}`);
console.log(`Today's change:    $${snap.totalDayChange.toFixed(2)}`);

for (const pos of snap.positions) {
  const pct = (pos.unrealizedPnlPct * 100).toFixed(2);
  console.log(`${pos.symbol}: $${pos.marketValue.toFixed(2)} (${pct}%)`);
}
```

#### `Position`

| Field | Type | Description |
|-------|------|-------------|
| `symbol` | `string` | Ticker symbol |
| `quantity` | `number` | Units held. Negative = short. |
| `avgCost` | `number` | Average cost per unit |
| `currency` | `string?` | Defaults to "USD" |
| `openedAt` | `Date?` | When the position was opened |
| `notes` | `string?` | Free-form notes |

#### `Portfolio` API

```ts
portfolio.add(position)          // add or replace a position (chainable)
portfolio.remove(symbol)         // remove a position (chainable)
portfolio.get(symbol)            // Position | undefined
portfolio.list()                 // readonly Position[]
portfolio.size                   // number
portfolio.snapshot(feed)         // Promise<PortfolioSnapshot>
```

---

### `market-feed/backtest`

Pure-function backtesting engine over `HistoricalBar[]`. No network, no side effects.

```ts
import { backtest } from "market-feed/backtest";
import type { EntrySignal, ExitSignal } from "market-feed/backtest";
import { MarketFeed } from "market-feed";

const feed = new MarketFeed();
const bars = await feed.historical("AAPL", { period1: "2020-01-01", interval: "1d" });

// Buy when today's close > yesterday's close (momentum)
const entry: EntrySignal = (bars, i) => i > 0 && bars[i]!.close > bars[i - 1]!.close;

// Sell when today's close < yesterday's close
const exit: ExitSignal = (bars, i, _entryPrice) => i > 0 && bars[i]!.close < bars[i - 1]!.close;

const result = backtest("AAPL", bars, entry, exit, {
  initialCapital: 10_000,
  quantity: 10,
  commission: 1,
});

console.log(`Total return:    ${(result.totalReturn * 100).toFixed(2)}%`);
console.log(`Annualised CAGR: ${(result.annualizedReturn * 100).toFixed(2)}%`);
console.log(`Sharpe ratio:    ${result.sharpeRatio.toFixed(2)}`);
console.log(`Max drawdown:    ${(result.maxDrawdown * 100).toFixed(2)}%`);
console.log(`Win rate:        ${(result.winRate * 100).toFixed(1)}%`);
console.log(`Trades:          ${result.totalTrades}`);
```

Signals fire at bar[i].close. Any open position is closed at the last bar. At most one position is held at a time.

#### `BacktestOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `initialCapital` | `number` | `100_000` | Starting capital |
| `quantity` | `number` | `1` | Shares per trade |
| `commission` | `number` | `0` | One-way commission per trade |

#### `BacktestResult`

| Field | Description |
|-------|-------------|
| `totalReturn` | Fraction — e.g. `0.25` = 25% |
| `annualizedReturn` | CAGR as a fraction |
| `sharpeRatio` | Annualised Sharpe (risk-free rate = 0) |
| `maxDrawdown` | Positive fraction — peak-to-trough |
| `winRate` | Fraction of profitable trades |
| `profitFactor` | Gross profit / gross loss (`Infinity` = no losses) |
| `totalTrades` | Completed round-trip trades |
| `trades` | `BacktestTrade[]` ledger |

---

### `market-feed/alerts`

Poll a quote feed and yield `AlertEvent` whenever a configured condition is met.

```ts
import { watchAlerts } from "market-feed/alerts";
import type { AlertConfig } from "market-feed/alerts";
import { MarketFeed } from "market-feed";

const feed = new MarketFeed();
const controller = new AbortController();

const alerts: AlertConfig[] = [
  // Fire once when AAPL crosses $200
  { symbol: "AAPL", condition: { type: "price_above", threshold: 200 }, once: true },
  // Alert on TSLA intraday crash; debounce 5 min to avoid spam
  { symbol: "TSLA", condition: { type: "change_pct_below", threshold: -5 }, debounceMs: 300_000 },
  // Unusual volume spike on MSFT
  { symbol: "MSFT", condition: { type: "volume_above", threshold: 100_000_000 } },
];

for await (const event of watchAlerts(feed, alerts, {
  intervalMs: 5_000,
  signal: controller.signal,
})) {
  console.log(
    `[${event.triggeredAt.toISOString()}] ${event.alert.symbol} triggered: $${event.quote.price}`,
  );
}
```

#### Alert conditions

| `type` | Fires when |
|--------|-----------|
| `price_above` | `quote.price > threshold` |
| `price_below` | `quote.price < threshold` |
| `change_pct_above` | `quote.changePercent > threshold` |
| `change_pct_below` | `quote.changePercent < threshold` |
| `volume_above` | `quote.volume > threshold` |

#### `AlertConfig`

| Field | Type | Description |
|-------|------|-------------|
| `symbol` | `string` | Ticker to watch |
| `condition` | `AlertCondition` | Trigger condition |
| `once` | `boolean?` | Remove after first fire. Default: `false` |
| `debounceMs` | `number?` | Suppress re-fires within this window. Default: `0` |

When all `once` alerts have fired, the generator terminates automatically. Permanent alerts (`once: false`) run until `signal.abort()` is called. Transient fetch errors are silently retried.

---

### `market-feed/fundamentals`

Fetch income statements, balance sheets, and cash flow statements for any public company.

```ts
import { getFundamentals } from "market-feed/fundamentals";
import { MarketFeed } from "market-feed";

const feed = new MarketFeed();

// Fetch all three statements in parallel — partial failure is OK
const { incomeStatements, balanceSheets, cashFlows } = await getFundamentals(feed, "AAPL");

const latest = incomeStatements[0]!;
console.log(`Revenue:   $${(latest.revenue! / 1e9).toFixed(1)}B`);
console.log(`Net income: $${(latest.netIncome! / 1e9).toFixed(1)}B`);
console.log(`Diluted EPS: $${latest.dilutedEps?.toFixed(2)}`);

// Quarterly statements
const { incomeStatements: quarterly } = await getFundamentals(feed, "AAPL", {
  quarterly: true,
  limit: 4,
});
```

`getFundamentals()` fires all three queries with `Promise.allSettled` — if one statement type fails, the others still return.

#### `IncomeStatement`

| Field | Description |
|-------|-------------|
| `revenue` | Total revenue |
| `grossProfit` | Revenue − cost of revenue |
| `operatingIncome` | Operating income (EBIT) |
| `netIncome` | Bottom-line net income |
| `ebitda` | EBITDA |
| `dilutedEps` | Diluted EPS |

#### `BalanceSheet`

| Field | Description |
|-------|-------------|
| `totalAssets` | Total assets |
| `totalLiabilities` | Total liabilities |
| `totalStockholdersEquity` | Book value of equity |
| `cashAndCashEquivalents` | Cash + equivalents |
| `totalDebt` | Short + long-term debt |

#### `CashFlowStatement`

| Field | Description |
|-------|-------------|
| `operatingCashFlow` | Cash from operations |
| `capitalExpenditures` | CapEx (negative = outflow) |
| `freeCashFlow` | `operatingCashFlow + capitalExpenditures` |
| `investingCashFlow` | Cash from investing |
| `financingCashFlow` | Cash from financing |

All three types include `symbol`, `date` (period end date), `periodType` (`"annual"` | `"quarterly"`), and `provider`.

#### `MarketFeed` methods

```ts
feed.incomeStatements(symbol, options?)  // Promise<IncomeStatement[]>
feed.balanceSheets(symbol, options?)     // Promise<BalanceSheet[]>
feed.cashFlows(symbol, options?)         // Promise<CashFlowStatement[]>
```

| `FundamentalsOptions` | Default | Description |
|-----------------------|---------|-------------|
| `quarterly` | `false` | Return quarterly instead of annual periods |
| `limit` | unlimited | Max number of periods to return |
| `raw` | `false` | Include raw provider response on each object |

---

### `market-feed/screener`

Filter a list of symbols against a set of criteria using live quote data.

```ts
import { screen } from "market-feed/screener";
import { MarketFeed } from "market-feed";

const feed = new MarketFeed();

// Find large-caps that gained > 1.5% today on high volume
const results = await screen(feed, ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA", "META"], {
  criteria: [
    { type: "market_cap_above", value: 100_000_000_000 },
    { type: "change_pct_above", value: 1.5 },
    { type: "volume_above",     value: 10_000_000 },
  ],
  limit: 5,
});

for (const r of results) {
  console.log(`${r.symbol}: $${r.quote.price.toFixed(2)} (+${r.quote.changePercent.toFixed(2)}%)`);
}
```

All criteria are evaluated with **AND logic** — a symbol must pass every criterion to be included.

#### Criterion types

| Type | Passes when |
|------|-------------|
| `price_above` / `price_below` | `quote.price > / < value` |
| `change_pct_above` / `change_pct_below` | `quote.changePercent > / < value` |
| `volume_above` / `volume_below` | `quote.volume > / < value` |
| `market_cap_above` / `market_cap_below` | `quote.marketCap > / < value` (skips if undefined) |
| `52w_high_pct_below` | Price is within N% of the 52-week high |
| `52w_low_pct_above` | Price is at least N% above the 52-week low |
| `custom` | `{ type: "custom", fn: (quote: Quote) => boolean }` |

#### `ScreenerOptions`

| Option | Default | Description |
|--------|---------|-------------|
| `criteria` | required | Array of `ScreenerCriterion` |
| `batchSize` | all at once | Max symbols per `quote()` call |
| `limit` | unlimited | Max results to return |

`screen()` accepts any object with a `quote(symbols[]) → Quote[]` method — works with `MarketFeed`, individual providers, or a test mock.

---

### `market-feed/react`

React hooks for live market data. Requires React ≥ 18 (peer dependency).

```bash
npm install market-feed react
```

```tsx
import { useQuote, useStream, useAlerts } from "market-feed/react";
import { MarketFeed } from "market-feed";

const feed = new MarketFeed();

// Poll a quote every 5 seconds
function StockPrice({ symbol }: { symbol: string }) {
  const { data, loading, error } = useQuote(feed, symbol);
  if (loading) return <span>Loading…</span>;
  if (error)   return <span>Error: {error.message}</span>;
  return <span>{symbol}: ${data?.price.toFixed(2)}</span>;
}

// Subscribe to a live watch() stream
function LiveFeed() {
  const { event } = useStream(feed, ["AAPL", "MSFT", "GOOGL"]);
  if (!event || event.type !== "quote") return null;
  return <p>{event.symbol}: ${event.quote.price.toFixed(2)}</p>;
}

// Collect price alerts
function AlertLog() {
  const { events, clearEvents } = useAlerts(feed, [
    { symbol: "AAPL", condition: { type: "price_above", threshold: 200 }, once: false },
  ]);
  return (
    <ul>
      {events.map((e, i) => (
        <li key={i}>{e.alert.symbol} triggered @ ${e.quote.price.toFixed(2)}</li>
      ))}
      <button onClick={clearEvents}>Clear</button>
    </ul>
  );
}
```

#### Hook reference

**`useQuote(source, symbol, options?)`** — polls a quote at a regular interval.

| Option | Default | Description |
|--------|---------|-------------|
| `intervalMs` | `5000` | Poll interval in milliseconds |
| `enabled` | `true` | Set to `false` to suspend polling |

Returns `{ data: Quote \| null, loading: boolean, error: Error \| null, refetch() }`.

**`useStream(feed, symbols, options?)`** — drives a `watch()` async generator. Restarts automatically when `symbols` changes; stops on unmount via an internal `AbortSignal`.

Returns `{ event: StreamEvent \| null, error: Error \| null }`.

**`useAlerts(feed, alerts, options?)`** — drives a `watchAlerts()` async generator. Accumulates triggered events; restarts when alert definitions change.

Returns `{ events: AlertEvent[], error: Error \| null, clearEvents() }`.

---

### CLI (`npx market-feed`)

A zero-config CLI powered by Yahoo Finance (no API key needed). Add keys to unlock more providers.

```bash
# Quotes
npx market-feed quote AAPL MSFT GOOGL

# Historical data
npx market-feed historical AAPL --interval 1wk --period1 2024-01-01

# Symbol search
npx market-feed search "apple inc"

# Company profile
npx market-feed company AAPL

# News (JSON output)
npx market-feed news AAPL --limit 5 --json

# Corporate actions
npx market-feed earnings AAPL
npx market-feed dividends AAPL
npx market-feed splits AAPL
```

#### Options

| Flag | Description |
|------|-------------|
| `--av-key <key>` | Alpha Vantage API key |
| `--polygon-key <key>` | Polygon.io API key |
| `--finnhub-key <key>` | Finnhub API key |
| `--td-key <key>` | Twelve Data API key |
| `--tiingo-key <key>` | Tiingo API key |
| `--json` | Output raw JSON instead of formatted tables |
| `--limit <n>` | Limit results (default: 10) |
| `--interval <i>` | Historical interval: `1m` `5m` `15m` `30m` `1h` `1d` `1wk` `1mo` (default: `1d`) |
| `--period1 <date>` | Historical start date (ISO 8601) |
| `--period2 <date>` | Historical end date (ISO 8601) |
| `-h`, `--help` | Show help |

---

## Install

```bash
npm install market-feed
# or
pnpm add market-feed
# or
bun add market-feed
```

---

## Quick Start

```ts
import { MarketFeed } from "market-feed";

// Zero-config — uses Yahoo Finance, no API key needed
const feed = new MarketFeed();

// Single quote
const aapl = await feed.quote("AAPL");
console.log(`${aapl.symbol}: $${aapl.price.toFixed(2)}`);

// Multiple quotes (parallel)
const quotes = await feed.quote(["MSFT", "GOOGL", "AMZN"]);

// Historical data
const history = await feed.historical("AAPL", {
  period1: "2024-01-01",
  period2: "2024-12-31",
  interval: "1d",
});

// Search
const results = await feed.search("Tesla");

// Company profile
const profile = await feed.company("AAPL");
console.log(profile.sector); // "Technology"
```

---

## Providers

| Provider | API Key | Quote | Historical | Search | Company | News | Fundamentals |
|----------|---------|:-----:|:----------:|:------:|:-------:|:----:|:------------:|
| **Yahoo Finance** | Not required | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| **Alpha Vantage** | Free (25/day) | ✓ | ✓ | ✓ | ✓ | — | — |
| **Polygon.io** | Free (delayed) | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| **Finnhub** | Free (60/min) | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| **Twelve Data** | Free (800/day) | ✓ | ✓ | ✓ | ✓ | — | — |
| **Tiingo** | Free (1000/day) | ✓ | ✓ | ✓ | ✓ | ✓ | — |

Get free keys: [Alpha Vantage](https://www.alphavantage.co/support/#api-key) · [Polygon.io](https://polygon.io/) · [Finnhub](https://finnhub.io/) · [Twelve Data](https://twelvedata.com/) · [Tiingo](https://www.tiingo.com/)

### Using multiple providers

```ts
import {
  MarketFeed,
  YahooProvider,
  AlphaVantageProvider,
  PolygonProvider,
  FinnhubProvider,
  TwelveDataProvider,
  TiingoProvider,
} from "market-feed";

const feed = new MarketFeed({
  providers: [
    new YahooProvider(),
    new AlphaVantageProvider({ apiKey: process.env.AV_KEY }),
    new PolygonProvider({ apiKey: process.env.POLYGON_KEY }),
    new FinnhubProvider({ apiKey: process.env.FINNHUB_KEY }),
    new TwelveDataProvider({ apiKey: process.env.TD_KEY }),
    new TiingoProvider({ apiKey: process.env.TIINGO_KEY }),
  ],
  fallback: true, // auto-try next provider on failure
});
```

---

## Caching

The default LRU cache stores responses in memory with sensible TTLs:

| Method | Default TTL |
|--------|-------------|
| `quote` | 60s |
| `historical` | 1 hour |
| `company` | 24 hours |
| `news` | 5 minutes |
| `search` | 10 minutes |
| `marketStatus` | 60s |
| `earnings` | 1 hour |
| `dividends` | 24 hours |
| `splits` | 24 hours |
| `incomeStatements` | 24 hours |
| `balanceSheets` | 24 hours |
| `cashFlows` | 24 hours |

### Override TTLs

```ts
const feed = new MarketFeed({
  cache: {
    ttl: 60,        // default fallback TTL
    maxSize: 1000,  // max entries in memory
    ttlOverrides: {
      quote: 15,          // aggressive refresh for real-time feel
      company: 604800,    // company profiles change rarely
    },
  },
});
```

### Disable caching

```ts
const feed = new MarketFeed({ cache: false });
```

### Custom cache driver (Redis, Upstash, filesystem...)

```ts
import type { CacheDriver } from "market-feed";
import { createClient } from "redis";

const redis = createClient();
await redis.connect();

const driver: CacheDriver = {
  async get<T>(key: string) {
    const val = await redis.get(key);
    return val ? (JSON.parse(val) as T) : undefined;
  },
  async set<T>(key: string, value: T, ttl = 60) {
    await redis.set(key, JSON.stringify(value), { EX: ttl });
  },
  async delete(key: string) { await redis.del(key); },
  async clear() { await redis.flushDb(); },
};

const feed = new MarketFeed({ cache: { driver } });
```

---

## API Reference

### `new MarketFeed(options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `providers` | `MarketProvider[]` | `[new YahooProvider()]` | Provider chain |
| `cache` | `CacheConfig \| false` | LRU, 60s TTL | Cache configuration |
| `fallback` | `boolean` | `true` | Auto-failover on provider error |

### Methods

```ts
// Quotes
feed.quote(symbol: string, options?: QuoteOptions): Promise<Quote>
feed.quote(symbols: string[], options?: QuoteOptions): Promise<Quote[]>

// Historical bars
feed.historical(symbol: string, options?: HistoricalOptions): Promise<HistoricalBar[]>

// Symbol search
feed.search(query: string, options?: SearchOptions): Promise<SearchResult[]>

// Company profile
feed.company(symbol: string, options?: CompanyOptions): Promise<CompanyProfile>

// News
feed.news(symbol: string, options?: NewsOptions): Promise<NewsItem[]>

// Market status
feed.marketStatus(market?: string): Promise<MarketStatus>

// Earnings history (EPS actuals vs. estimates)
feed.earnings(symbol: string, options?: EarningsOptions): Promise<EarningsEvent[]>

// Cash dividend history
feed.dividends(symbol: string, options?: DividendOptions): Promise<DividendEvent[]>

// Stock split history
feed.splits(symbol: string, options?: SplitOptions): Promise<SplitEvent[]>

// Financial statements
feed.incomeStatements(symbol: string, options?: FundamentalsOptions): Promise<IncomeStatement[]>
feed.balanceSheets(symbol: string, options?: FundamentalsOptions): Promise<BalanceSheet[]>
feed.cashFlows(symbol: string, options?: FundamentalsOptions): Promise<CashFlowStatement[]>

// Cache management
feed.clearCache(): Promise<void>
feed.invalidate(key: string): Promise<void>
```

### `HistoricalOptions`

```ts
interface HistoricalOptions {
  period1?: string | Date;   // start date, default: 1 year ago
  period2?: string | Date;   // end date, default: today
  interval?: "1m" | "2m" | "5m" | "15m" | "30m" | "60m" | "1h"
           | "1d" | "5d" | "1wk" | "1mo" | "3mo";  // default: "1d"
  raw?: boolean;
}
```

---

## Error Handling

```ts
import {
  MarketFeedError,
  ProviderError,
  RateLimitError,
  AllProvidersFailedError,
} from "market-feed";

try {
  const quote = await feed.quote("AAPL");
} catch (err) {
  if (err instanceof RateLimitError) {
    console.log(`Rate limited. Retry after: ${err.retryAfter?.toISOString()}`);
  } else if (err instanceof AllProvidersFailedError) {
    console.log("All providers failed:", err.errors.map(e => e.message));
  } else if (err instanceof ProviderError) {
    console.log(`Provider error (${err.provider}): ${err.message}`);
  }
}
```

---

## Building a Custom Provider

Implement the `MarketProvider` interface to add any data source:

```ts
import type { MarketProvider, Quote } from "market-feed";

class MyProvider implements MarketProvider {
  readonly name = "my-provider";

  async quote(symbols: string[]): Promise<Quote[]> {
    // fetch from your API, return normalised Quote objects
  }

  async historical(symbol: string, options) {
    // ...
  }

  async search(query: string) {
    // ...
  }
}

const feed = new MarketFeed({ providers: [new MyProvider()] });
```

---

## Runtime Compatibility

| Runtime | Version | Notes |
|---------|---------|-------|
| Node.js | 18+ | `fetch` available since Node 18; `WebSocket` global available since Node 21. For Node 18–20, inject the `ws` package via `wsImpl` for `market-feed/ws`. |
| Bun | 1+ | Fully supported |
| Deno | 2+ | Fully supported |
| Cloudflare Workers | Latest | Fully supported |
| Browser | — | Not supported — Yahoo Finance blocks CORS. Use a server-side proxy. |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). All contributions welcome.

```bash
git clone https://github.com/piyushgupta344/market-feed
cd market-feed
pnpm install
pnpm test
```

---

## Disclaimer

This library is not affiliated with or endorsed by Yahoo Finance, Alpha Vantage, Polygon.io, Finnhub, Twelve Data, or Tiingo. Data is provided for informational purposes only and should not be used as the sole basis for investment decisions.

---

## License

[MIT](LICENSE)
