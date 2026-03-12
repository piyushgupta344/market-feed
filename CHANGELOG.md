# market-feed Changelog

## 0.7.0 — 2026-03-12

### New provider

**`TiingoProvider`** — Tiingo (free tier: EOD prices, real-time IEX quotes, news).

```ts
import { MarketFeed, TiingoProvider } from "market-feed";

const feed = new MarketFeed([
  new TiingoProvider({ apiKey: process.env.TIINGO_KEY! }),
]);

const quote   = await feed.quote(["AAPL"]);
const bars    = await feed.historical("AAPL", { period1: "2024-01-01" });
const results = await feed.search("apple");
const profile = await feed.company("AAPL");
const news    = await feed.news("AAPL", { limit: 5 });
```

Supports: `quote`, `historical`, `search`, `company`, `news`.

| Feature | Detail |
|---------|--------|
| Real-time quotes | IEX endpoint — US equities, intraday |
| Historical | EOD daily bars, includes `adjClose` |
| Rate limit | ~50 calls/hour (free plan) |
| Auth | `Authorization: Token KEY` header |

Free plan sign-up: https://www.tiingo.com

### CLI

`--tiingo-key <key>` flag adds `TiingoProvider` to the CLI provider chain.

### Breaking changes

None. All v0.6.x imports continue to work unchanged.

### Other changes

- `TiingoProvider` and `TiingoProviderOptions` exported from main `market-feed` entry point
- 21 new unit tests (447 total across 23 test files)

---

## 0.6.0 — 2026-03-12

### New provider

**`TwelveDataProvider`** — Twelve Data (free tier: 800 credits/day, 8 calls/minute).

```ts
import { MarketFeed, TwelveDataProvider } from "market-feed";

const feed = new MarketFeed([
  new TwelveDataProvider({ apiKey: process.env.TWELVE_DATA_KEY! }),
]);

const quote   = await feed.quote(["AAPL", "BTC/USD", "EUR/USD"]);
const bars    = await feed.historical("AAPL", { interval: "1wk" });
const results = await feed.search("apple");
const profile = await feed.company("AAPL");
```

Supports: `quote`, `historical`, `search`, `company`.

Strong coverage for global equities, forex, and crypto pairs. Symbol normalisation handles all common formats:
- US stocks: `AAPL` (unchanged)
- Crypto: `BTC-USD` / `BTC/USD` / `X:BTCUSD` → `BTC/USD`
- Forex: `EURUSD=X` / `C:EURUSD` → `EUR/USD`

Free plan sign-up: https://twelvedata.com

#### Interval mapping

| market-feed | Twelve Data |
|-------------|-------------|
| `1m` | `1min` |
| `5m` | `5min` |
| `15m` | `15min` |
| `30m` | `30min` |
| `1h` | `1h` |
| `1d` | `1day` |
| `1wk` | `1week` |
| `1mo` | `1month` |

### New utility

**`toTwelveDataSymbol(symbol)`** — exported from main `market-feed` entry point. Converts any supported symbol format (Yahoo/Polygon/standard) to the slash-pair notation that Twelve Data expects for crypto and forex.

### CLI

`--td-key <key>` flag adds `TwelveDataProvider` to the CLI provider chain.

### Breaking changes

None. All v0.5.x imports continue to work unchanged.

### Other changes

- `TwelveDataProvider` and `TwelveDataProviderOptions` exported from main `market-feed` entry point
- `toTwelveDataSymbol` exported from main `market-feed` entry point
- 30 new unit tests (456 total across 22 test files)

---

## 0.5.1 — 2026-03-12

### CLI additions

Three new commands expose the v0.5.0 corporate-action data from the terminal:

```bash
market-feed earnings AAPL --limit 8
market-feed dividends AAPL --from 2020-01-01
market-feed splits AAPL --json
```

New flags `--from <date>` and `--to <date>` scope the dividend/split history by date range (ISO 8601). `--limit` and `--json` work on all three commands.

### Breaking changes

None.

---

## 0.5.0 — 2026-03-11

### New modules

**`market-feed/backtest`** — Pure-function backtesting engine over `HistoricalBar[]`.

```ts
import { backtest } from "market-feed/backtest";
import type { EntrySignal, ExitSignal } from "market-feed/backtest";

const entry: EntrySignal = (bars, i) => i > 0 && bars[i]!.close > bars[i - 1]!.close;
const exit: ExitSignal  = (bars, i) => i > 0 && bars[i]!.close < bars[i - 1]!.close;

const result = backtest("AAPL", bars, entry, exit, { initialCapital: 10_000 });
console.log(`Total return: ${(result.totalReturn * 100).toFixed(2)}%`);
console.log(`Sharpe ratio: ${result.sharpeRatio.toFixed(2)}`);
console.log(`Max drawdown: ${(result.maxDrawdown * 100).toFixed(2)}%`);
```

| Field | Description |
|-------|-------------|
| `totalReturn` | Fraction, e.g. 0.25 = 25% |
| `annualizedReturn` | CAGR as a fraction |
| `sharpeRatio` | Annualised Sharpe (risk-free rate = 0) |
| `maxDrawdown` | Peak-to-trough as a positive fraction |
| `winRate` | Fraction of profitable trades |
| `profitFactor` | Gross profit / gross loss (`Infinity` when no losses) |
| `totalTrades` | Number of completed round-trip trades |
| `trades` | Full `BacktestTrade[]` ledger |

**`market-feed/alerts`** — Poll a feed and yield `AlertEvent` when conditions are met.

```ts
import { watchAlerts } from "market-feed/alerts";
import { MarketFeed } from "market-feed";

const feed = new MarketFeed();
const controller = new AbortController();

for await (const event of watchAlerts(feed, [
  { symbol: "AAPL", condition: { type: "price_above", threshold: 200 }, once: true },
  { symbol: "TSLA", condition: { type: "change_pct_below", threshold: -5 }, debounceMs: 60_000 },
], { signal: controller.signal })) {
  console.log(`${event.alert.symbol} triggered: $${event.quote.price}`);
}
```

| Condition type | Description |
|----------------|-------------|
| `price_above` | `quote.price > threshold` |
| `price_below` | `quote.price < threshold` |
| `change_pct_above` | Daily `%` change exceeds threshold |
| `change_pct_below` | Daily `%` change falls below threshold |
| `volume_above` | `quote.volume > threshold` |

`AlertConfig` options: `once` (fire at most once), `debounceMs` (suppress re-fires within window).

### New data: earnings, dividends, splits

Three new methods on `MarketFeed` (and on individual providers):

```ts
const feed = new MarketFeed([new PolygonProvider({ apiKey: "..." })]);

const earnings  = await feed.earnings("AAPL", { limit: 8 });
const dividends = await feed.dividends("AAPL");
const splits    = await feed.splits("AAPL");
```

#### Provider support

| Method | `YahooProvider` | `PolygonProvider` | `FinnhubProvider` | `AlphaVantageProvider` |
|--------|-----------------|-------------------|-------------------|------------------------|
| `earnings` | ✓ quoteSummary `earningsHistory` | — | ✓ `/stock/earnings` | — |
| `dividends` | ✓ chart `events=div` | ✓ `/v3/reference/dividends` | — | — |
| `splits` | ✓ chart `events=split` | ✓ `/v3/reference/splits` | — | — |

#### `EarningsEvent`

```ts
interface EarningsEvent {
  symbol: string; date: Date; period?: string;
  epsActual?: number; epsEstimate?: number; epsSurprisePct?: number;
  revenueActual?: number; revenueEstimate?: number;
  provider: string; raw?: unknown;
}
```

#### `DividendEvent`

```ts
interface DividendEvent {
  symbol: string; exDate: Date; payDate?: Date; declaredDate?: Date;
  amount: number; currency: string;
  frequency?: "annual" | "semi-annual" | "quarterly" | "monthly" | "irregular";
  provider: string; raw?: unknown;
}
```

#### `SplitEvent`

```ts
interface SplitEvent {
  symbol: string; date: Date;
  ratio: number;      // 4-for-1 forward split → 4; 1-for-10 reverse → 0.1
  description?: string;
  provider: string; raw?: unknown;
}
```

### Other changes

- `CacheMethod` extended with `"earnings" | "dividends" | "splits"` (TTLs: earnings 1 h, dividends/splits 24 h)
- All new types exported from main `market-feed` entry point
- 51 new unit tests (392 total across 21 test files)
- 9 tsup library entry points + 1 CLI binary: `index`, `calendar`, `stream`, `consensus`, `indicators`, `portfolio`, `ws`, `backtest`, `alerts`, `cli`

### Breaking changes

None. All v0.4.0 imports continue to work unchanged.

---

## 0.4.0 — 2026-03-11

### New module

**`market-feed/ws`** — True WebSocket streaming for tick-by-tick trade data.

Unlike `market-feed/stream` (which is HTTP polling), `market-feed/ws` opens a
persistent WebSocket connection and yields individual trade executions in real time.

```ts
import { connect } from "market-feed/ws";
import { FinnhubProvider } from "market-feed";

const provider = new FinnhubProvider({ apiKey: process.env.FINNHUB_KEY! });
const controller = new AbortController();

for await (const event of connect(provider, ["AAPL", "MSFT"], { signal: controller.signal })) {
  switch (event.type) {
    case "trade":
      console.log(`${event.trade.symbol}: $${event.trade.price} × ${event.trade.size}`);
      break;
    case "connected":
      console.log(`Connected to ${event.provider}`);
      break;
    case "disconnected":
      console.log(`Disconnected (reconnecting: ${event.reconnecting})`);
      break;
    case "error":
      if (!event.recoverable) throw event.error;
      break;
  }
}
```

#### Provider support

| Provider | WebSocket | Notes |
|----------|-----------|-------|
| **PolygonProvider** | Native WS | `wss://socket.polygon.io/stocks` — auth via JSON handshake, subscribes to `T.*` trade channel |
| **FinnhubProvider** | Native WS | `wss://ws.finnhub.io?token=KEY` — per-symbol subscribe, batched trade messages |
| **YahooProvider** | Polling fallback | Polls `provider.quote()` every 5 s; emits `WsTrade` from quote data |
| **AlphaVantageProvider** | Polling fallback | Same as Yahoo |

The `connect()` function detects provider capability automatically — no configuration required.

#### `WsEvent` union

| `type` | Payload | When |
|--------|---------|------|
| `"connected"` | `provider: string` | WS opened (and after each reconnect) |
| `"trade"` | `trade: WsTrade` | Each trade tick |
| `"disconnected"` | `provider`, `reconnecting`, `attempt` | WS closed unexpectedly |
| `"error"` | `error`, `recoverable` | Protocol or network error |

#### `WsTrade`

```ts
interface WsTrade {
  symbol: string;
  price: number;
  size: number;         // shares / units
  timestamp: Date;
  conditions?: number[]; // provider-specific condition codes
}
```

#### `WsOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `wsImpl` | `typeof globalThis.WebSocket` | `globalThis.WebSocket` | Custom WS constructor for Node 18–20 |
| `maxReconnectAttempts` | `number` | `10` | Reconnect attempts before closing |
| `reconnectDelayMs` | `number` | `1000` | Base delay (doubles per attempt, max 30 s) |
| `signal` | `AbortSignal` | — | Stop the stream |

#### Node 18–20 compatibility

Node 21+ exposes `WebSocket` globally. For Node 18/20, install the `ws` package and inject it:

```ts
import WebSocket from "ws";
connect(provider, ["AAPL"], { wsImpl: WebSocket as unknown as typeof globalThis.WebSocket })
```

### Other changes

- `PolygonProvider` now exposes `get wsApiKey(): string` (used internally by `market-feed/ws`)
- `FinnhubProvider` now exposes `get wsApiKey(): string` (used internally by `market-feed/ws`)
- 27 new unit tests (341 total across 18 test files)
- 7 tsup library entry points + 1 CLI binary: `index`, `calendar`, `stream`, `consensus`, `indicators`, `portfolio`, `ws`, `cli`

### Breaking changes

None. All v0.3.0 imports continue to work unchanged.

---

## 0.3.0 — 2026-03-11

### New provider

**`FinnhubProvider`** — Finnhub.io (free tier: real-time US stock data, 60 calls/minute).
- `quote`, `historical` (candles), `search`, `company`, `news`
- API key required — get one free at https://finnhub.io
- Uses `X-Finnhub-Token` header; rate-limited client-side at 60 req/min
- `historical` maps standard intervals to Finnhub resolutions (1m→"1", 1d→"D", 1wk→"W", 1mo→"M")
- `news` fetches articles from the last 30 days by default

### New modules

**`market-feed/indicators`** — Technical indicators as pure functions over `HistoricalBar[]`.
- `sma(bars, period)` — Simple Moving Average (O(1) sliding window)
- `ema(bars, period)` — Exponential Moving Average (k = 2/(period+1), SMA-seeded)
- `rsi(bars, period?)` — Relative Strength Index via Wilder's smoothing (default period: 14)
- `macd(bars, fast?, slow?, signal?)` — MACD line, signal line, histogram (default 12/26/9)
- `bollingerBands(bars, period?, stdDevMult?)` — upper/middle/lower bands (default 20/2)
- `atr(bars, period?)` — Average True Range via Wilder's smoothing (default period: 14)
- `vwap(bars)` — Volume-Weighted Average Price (cumulative from first bar)
- `stochastic(bars, kPeriod?, dPeriod?)` — %K and %D oscillator (default 14/3)
- Zero dependencies, no network, tree-shakeable per indicator
- All functions return typed result arrays (`IndicatorPoint[]`, `MACDPoint[]`, `BollingerPoint[]`, `StochasticPoint[]`)

**`market-feed/portfolio`** — Track positions and compute live P&L.
- `new Portfolio(positions?)` — construct with an array of `Position` objects
- `portfolio.add(position)` / `portfolio.remove(symbol)` — mutable, chainable
- `portfolio.snapshot(feed)` — fetches live quotes and returns `PortfolioSnapshot` with per-position and aggregate P&L
- `PositionSnapshot` includes: `marketValue`, `costBasis`, `unrealizedPnl`, `unrealizedPnlPct`, `dayChange`, `dayChangePct`, `quote`
- `PortfolioSnapshot` includes aggregate totals: `totalMarketValue`, `totalCostBasis`, `totalUnrealizedPnl`, `totalDayChange`
- Supports long and short positions (negative `quantity`)
- Uses `QuoteFetcher` duck-type interface — accepts any object with a `quote(symbols)` method, including `MarketFeed`

### CLI (`npx market-feed`)

A zero-install CLI that uses Yahoo Finance by default (no API key needed).

```
market-feed quote AAPL MSFT GOOGL
market-feed historical AAPL --interval 1wk --period1 2024-01-01
market-feed search "apple inc"
market-feed company AAPL
market-feed news AAPL --limit 5 --json
```

Flags: `--av-key`, `--polygon-key`, `--finnhub-key`, `--json`, `--limit`, `--interval`, `--period1`, `--period2`

### Crypto / Forex support

- `isCrypto(symbol)` — detects `"BTC-USD"`, `"BTC/USD"`, `"X:BTCUSD"` using a known-crypto-bases set
- `isForex(symbol)` — detects `"EURUSD=X"`, `"C:EURUSD"`, `"OANDA:EUR_USD"`, `"EUR/USD"`
- `toFinnhubSymbol(symbol)` — normalises symbol for Finnhub
- `CRYPTO` exchange added to the calendar — `alwaysOpen: true`, no holidays, no session boundaries
  - `isMarketOpen("CRYPTO")` → always `true`
  - `getSession("CRYPTO")` → always `"regular"`
  - `isHoliday("CRYPTO")` → always `false`
  - `nextSessionOpen("CRYPTO")` → returns `from` (already open)
  - `nextSessionClose("CRYPTO")` → returns `from + 24h` (rolling window)

### Breaking changes

None. All v0.2.0 imports continue to work unchanged.

### Other changes

- `isCrypto`, `isForex`, `toFinnhubSymbol` exported from main `market-feed` entry point
- `FinnhubProvider` and `FinnhubProviderOptions` exported from main `market-feed` entry point
- 94 new unit tests (314 total across 17 test files)
- 6 library tsup entry points + 1 CLI binary: `index`, `calendar`, `stream`, `consensus`, `indicators`, `portfolio`, `cli`

---

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
