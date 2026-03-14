# market-feed Changelog

## 1.1.1

### Patch Changes

- Maintenance: update dev tooling to vitest 4 / vite 6, add @types/node, patch devDep vulnerabilities, fix docs logo and Node 20+ references

## 1.1.0 — 2026-03-12

### New modules

**`market-feed/options`** — Options chains with full Greeks from Polygon.io.

```ts
import { getOptionChain } from "market-feed/options";
import { PolygonProvider } from "market-feed";

const polygon = new PolygonProvider({ apiKey: process.env.POLYGON_KEY! });
const chain = await getOptionChain(polygon, "AAPL", {
  expiry: "2024-07-19",
  type: "call",
  strikeLow: 170,
  strikeHigh: 210,
});

for (const c of chain.calls) {
  console.log(
    `Strike $${c.strike}  IV ${(c.impliedVolatility! * 100).toFixed(
      1
    )}%  Δ ${c.delta?.toFixed(3)}`
  );
}
```

Fields: `ticker`, `type`, `strike`, `expiry`, `style`, `sharesPerContract`, `bid`, `ask`, `midpoint`, `lastPrice`, `volume`, `openInterest`, `impliedVolatility`, `delta`, `gamma`, `theta`, `vega`, OHLCV.

---

**`market-feed/macro`** — Macroeconomic time-series data from the [FRED API](https://fred.stlouisfed.org/).

```ts
import { FredProvider, getIndicator, INDICATORS } from "market-feed/macro";

const fred = new FredProvider({ apiKey: process.env.FRED_KEY! });
const cpi = await getIndicator(fred, INDICATORS.CPI, { limit: 12 });

for (const obs of cpi.observations) {
  console.log(`${obs.date.toISOString().slice(0, 7)}: ${obs.value}`);
}
```

15 named constants in `INDICATORS`: `CPI`, `FED_FUNDS`, `UNEMPLOYMENT`, `GDP`, `M2`, `T10Y`, `T2Y`, `MORTGAGE_30Y`, `PCE`, `PPI`, `INDUSTRIAL_PRODUCTION`, `RETAIL_SALES`, `OIL_WTI`, `HOUSING_STARTS`, `CONSUMER_SENTIMENT`. Any FRED series ID string also accepted.

### Provider enhancements

**Polygon.io** — added `incomeStatements()`, `balanceSheets()`, `cashFlows()` via `/vX/reference/financials`.

**Tiingo** — added `incomeStatements()`, `balanceSheets()`, `cashFlows()` via `/tiingo/fundamentals/{ticker}/statements`.

### Screener additions

Two new criteria in `market-feed/screener`:

| Criterion             | Passes when                                                                    |
| --------------------- | ------------------------------------------------------------------------------ |
| `volume_vs_avg_above` | `quote.volume > quote.avgVolume * value` — e.g. `value: 2` = 2× average volume |
| `volume_vs_avg_below` | `quote.volume < quote.avgVolume * value`                                       |

Both pass-through when `avgVolume` is `undefined` (consistent with 52-week criteria).

### Client

- `MarketFeed.optionChain(symbol, options?)` — delegates to first provider supporting `optionChain`. Cache TTL: 60s.
- `CacheMethod` union extended with `"optionChain"`.

### Package

- `market-feed/options` and `market-feed/macro` added to `exports` and `keywords`.
- Total subpath modules: **14** (`market-feed`, `/calendar`, `/stream`, `/ws`, `/consensus`, `/indicators`, `/portfolio`, `/backtest`, `/alerts`, `/fundamentals`, `/screener`, `/options`, `/macro`, `/react`).

---

## 1.0.0 — 2026-03-12

### New module

**`market-feed/react`** — React hooks for live market data. Requires React ≥ 18.

```tsx
import { useQuote, useStream, useAlerts } from "market-feed/react";
import { MarketFeed } from "market-feed";

const feed = new MarketFeed();

// Poll a single quote
function StockPrice({ symbol }: { symbol: string }) {
  const { data, loading, error } = useQuote(feed, symbol);
  if (loading) return <span>…</span>;
  if (error) return <span>Error: {error.message}</span>;
  return (
    <span>
      {symbol}: ${data?.price.toFixed(2)}
    </span>
  );
}

// Subscribe to a live stream
function LiveFeed() {
  const { event } = useStream(feed, ["AAPL", "MSFT", "GOOGL"]);
  if (!event || event.type !== "quote") return null;
  return (
    <p>
      {event.symbol}: ${event.quote.price}
    </p>
  );
}

// Collect price alerts
function AlertLog() {
  const { events, clearEvents } = useAlerts(feed, [
    {
      symbol: "AAPL",
      condition: { type: "price_above", threshold: 200 },
      once: false,
    },
  ]);
  return (
    <ul>
      {events.map((e, i) => (
        <li key={i}>
          {e.alert.symbol} triggered @ ${e.quote.price}
        </li>
      ))}
      <button onClick={clearEvents}>Clear</button>
    </ul>
  );
}
```

#### Hook reference

**`useQuote(source, symbol, options?)`**

| Option       | Default | Description                       |
| ------------ | ------- | --------------------------------- |
| `intervalMs` | `5000`  | Poll interval in milliseconds     |
| `enabled`    | `true`  | Set to `false` to suspend polling |

Returns `{ data: Quote \| null, loading: boolean, error: Error \| null, refetch() }`.

**`useStream(feed, symbols, options?)`**

Drives a `watch()` async generator. Restarts automatically when `symbols` changes. Stops on unmount via an internal `AbortSignal`.

Returns `{ event: StreamEvent \| null, error: Error \| null }`.

**`useAlerts(feed, alerts, options?)`**

Drives a `watchAlerts()` async generator. Restarts when alert definitions (symbol + condition type + threshold) change.

Returns `{ events: AlertEvent[], error: Error \| null, clearEvents() }`.

#### Note on peer dependency

`react` is a peer dependency — install it separately in your project:

```
npm install react
```

---

## 0.9.0 — 2026-03-12

### New module

**`market-feed/screener`** — Filter a list of symbols against a set of criteria using live quote data.

```ts
import { screen } from "market-feed/screener";
import { MarketFeed } from "market-feed";

const feed = new MarketFeed();

const results = await screen(feed, ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA"], {
  criteria: [
    { type: "price_above", value: 100 },
    { type: "change_pct_above", value: 1.5 },
    { type: "volume_above", value: 10_000_000 },
    { type: "market_cap_above", value: 100_000_000_000 },
  ],
  limit: 10,
});

console.log(results.map((r) => `${r.symbol} @ ${r.quote.price}`));
```

#### Criterion types

| Type                                    | Description                                                       |
| --------------------------------------- | ----------------------------------------------------------------- |
| `price_above` / `price_below`           | Filter by current price                                           |
| `change_pct_above` / `change_pct_below` | Filter by daily % change                                          |
| `volume_above` / `volume_below`         | Filter by trading volume                                          |
| `market_cap_above` / `market_cap_below` | Filter by market cap                                              |
| `52w_high_pct_below`                    | Price is within N% of the 52-week high                            |
| `52w_low_pct_above`                     | Price is at least N% above the 52-week low                        |
| `custom`                                | Arbitrary predicate: `{ type: "custom", fn: (quote) => boolean }` |

All criteria are evaluated with **AND logic** — a symbol must pass every criterion to be included.

#### Options

| Option      | Description                                             |
| ----------- | ------------------------------------------------------- |
| `criteria`  | Array of `ScreenerCriterion` (required)                 |
| `batchSize` | Max symbols per quote fetch call (default: all at once) |
| `limit`     | Max number of results to return                         |

#### Result shape

```ts
interface ScreenerResult {
  symbol: string;
  quote: Quote;
  matchedCriteria: number; // always === criteria.length
}
```

`screen()` accepts any object with a `quote(symbols[]) → Quote[]` method — works with `MarketFeed`, individual providers, or your own mock.

---

## 0.8.0 — 2026-03-12

### New module

**`market-feed/fundamentals`** — Financial statement types and a `getFundamentals()` convenience function.

```ts
import { getFundamentals } from "market-feed/fundamentals";
import { MarketFeed } from "market-feed";

const feed = new MarketFeed();
const { incomeStatements, balanceSheets, cashFlows } = await getFundamentals(
  feed,
  "AAPL"
);

console.log(`Revenue: $${(incomeStatements[0]!.revenue! / 1e9).toFixed(1)}B`);
console.log(
  `Total assets: $${(balanceSheets[0]!.totalAssets! / 1e9).toFixed(1)}B`
);
console.log(
  `Free cash flow: $${(cashFlows[0]!.freeCashFlow! / 1e9).toFixed(1)}B`
);
```

`getFundamentals()` fetches all three statements in parallel via `Promise.allSettled` — a failure on one statement still returns the others.

#### `IncomeStatement`

| Field             | Description               |
| ----------------- | ------------------------- |
| `revenue`         | Total revenue             |
| `grossProfit`     | Revenue - cost of revenue |
| `operatingIncome` | EBIT (operating)          |
| `netIncome`       | Bottom-line net income    |
| `ebitda`          | EBITDA when available     |
| `dilutedEps`      | Diluted EPS               |

#### `BalanceSheet`

| Field                     | Description             |
| ------------------------- | ----------------------- |
| `totalAssets`             | Total assets            |
| `totalLiabilities`        | Total liabilities       |
| `totalStockholdersEquity` | Book value of equity    |
| `cashAndCashEquivalents`  | Cash + cash equivalents |
| `totalDebt`               | Short + long-term debt  |

#### `CashFlowStatement`

| Field                 | Description                             |
| --------------------- | --------------------------------------- |
| `operatingCashFlow`   | Cash from operations                    |
| `capitalExpenditures` | CapEx (negative = outflow)              |
| `freeCashFlow`        | operatingCashFlow + capitalExpenditures |
| `investingCashFlow`   | Cash from investing                     |
| `financingCashFlow`   | Cash from financing                     |

All three types include `symbol`, `date` (period end), `periodType` (`"annual"` | `"quarterly"`), and `provider`.

### New methods on `MarketFeed`

```ts
const feed = new MarketFeed();

const income = await feed.incomeStatements("AAPL", { limit: 4 });
const balance = await feed.balanceSheets("AAPL", { quarterly: true });
const cash = await feed.cashFlows("AAPL");
```

`FundamentalsOptions`: `quarterly?` (default `false`), `limit?` (default `4`), `raw?`.

### Provider support

| Method             | `YahooProvider`                                                    | others |
| ------------------ | ------------------------------------------------------------------ | ------ |
| `incomeStatements` | ✓ `incomeStatementHistory` / `incomeStatementHistoryQuarterly`     | —      |
| `balanceSheets`    | ✓ `balanceSheetHistory` / `balanceSheetHistoryQuarterly`           | —      |
| `cashFlows`        | ✓ `cashflowStatementHistory` / `cashflowStatementHistoryQuarterly` | —      |

### Breaking changes

None. All v0.7.x imports continue to work unchanged.

### Other changes

- New types `IncomeStatement`, `BalanceSheet`, `CashFlowStatement`, `FundamentalsOptions` exported from main `market-feed` entry point
- `CacheMethod` extended with `"incomeStatements" | "balanceSheets" | "cashFlows"` (TTL: 24 h each)
- 13 new unit tests (460 total across 24 test files)
- 10 tsup library entry points + 1 CLI binary

---

## 0.7.0 — 2026-03-12

### New provider

**`TiingoProvider`** — Tiingo (free tier: EOD prices, real-time IEX quotes, news).

```ts
import { MarketFeed, TiingoProvider } from "market-feed";

const feed = new MarketFeed([
  new TiingoProvider({ apiKey: process.env.TIINGO_KEY! }),
]);

const quote = await feed.quote(["AAPL"]);
const bars = await feed.historical("AAPL", { period1: "2024-01-01" });
const results = await feed.search("apple");
const profile = await feed.company("AAPL");
const news = await feed.news("AAPL", { limit: 5 });
```

Supports: `quote`, `historical`, `search`, `company`, `news`.

| Feature          | Detail                               |
| ---------------- | ------------------------------------ |
| Real-time quotes | IEX endpoint — US equities, intraday |
| Historical       | EOD daily bars, includes `adjClose`  |
| Rate limit       | ~50 calls/hour (free plan)           |
| Auth             | `Authorization: Token KEY` header    |

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

const quote = await feed.quote(["AAPL", "BTC/USD", "EUR/USD"]);
const bars = await feed.historical("AAPL", { interval: "1wk" });
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
| ----------- | ----------- |
| `1m`        | `1min`      |
| `5m`        | `5min`      |
| `15m`       | `15min`     |
| `30m`       | `30min`     |
| `1h`        | `1h`        |
| `1d`        | `1day`      |
| `1wk`       | `1week`     |
| `1mo`       | `1month`    |

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

const entry: EntrySignal = (bars, i) =>
  i > 0 && bars[i]!.close > bars[i - 1]!.close;
const exit: ExitSignal = (bars, i) =>
  i > 0 && bars[i]!.close < bars[i - 1]!.close;

const result = backtest("AAPL", bars, entry, exit, { initialCapital: 10_000 });
console.log(`Total return: ${(result.totalReturn * 100).toFixed(2)}%`);
console.log(`Sharpe ratio: ${result.sharpeRatio.toFixed(2)}`);
console.log(`Max drawdown: ${(result.maxDrawdown * 100).toFixed(2)}%`);
```

| Field              | Description                                           |
| ------------------ | ----------------------------------------------------- |
| `totalReturn`      | Fraction, e.g. 0.25 = 25%                             |
| `annualizedReturn` | CAGR as a fraction                                    |
| `sharpeRatio`      | Annualised Sharpe (risk-free rate = 0)                |
| `maxDrawdown`      | Peak-to-trough as a positive fraction                 |
| `winRate`          | Fraction of profitable trades                         |
| `profitFactor`     | Gross profit / gross loss (`Infinity` when no losses) |
| `totalTrades`      | Number of completed round-trip trades                 |
| `trades`           | Full `BacktestTrade[]` ledger                         |

**`market-feed/alerts`** — Poll a feed and yield `AlertEvent` when conditions are met.

```ts
import { watchAlerts } from "market-feed/alerts";
import { MarketFeed } from "market-feed";

const feed = new MarketFeed();
const controller = new AbortController();

for await (const event of watchAlerts(
  feed,
  [
    {
      symbol: "AAPL",
      condition: { type: "price_above", threshold: 200 },
      once: true,
    },
    {
      symbol: "TSLA",
      condition: { type: "change_pct_below", threshold: -5 },
      debounceMs: 60_000,
    },
  ],
  { signal: controller.signal }
)) {
  console.log(`${event.alert.symbol} triggered: $${event.quote.price}`);
}
```

| Condition type     | Description                            |
| ------------------ | -------------------------------------- |
| `price_above`      | `quote.price > threshold`              |
| `price_below`      | `quote.price < threshold`              |
| `change_pct_above` | Daily `%` change exceeds threshold     |
| `change_pct_below` | Daily `%` change falls below threshold |
| `volume_above`     | `quote.volume > threshold`             |

`AlertConfig` options: `once` (fire at most once), `debounceMs` (suppress re-fires within window).

### New data: earnings, dividends, splits

Three new methods on `MarketFeed` (and on individual providers):

```ts
const feed = new MarketFeed([new PolygonProvider({ apiKey: "..." })]);

const earnings = await feed.earnings("AAPL", { limit: 8 });
const dividends = await feed.dividends("AAPL");
const splits = await feed.splits("AAPL");
```

#### Provider support

| Method      | `YahooProvider`                  | `PolygonProvider`           | `FinnhubProvider`   | `AlphaVantageProvider` |
| ----------- | -------------------------------- | --------------------------- | ------------------- | ---------------------- |
| `earnings`  | ✓ quoteSummary `earningsHistory` | —                           | ✓ `/stock/earnings` | —                      |
| `dividends` | ✓ chart `events=div`             | ✓ `/v3/reference/dividends` | —                   | —                      |
| `splits`    | ✓ chart `events=split`           | ✓ `/v3/reference/splits`    | —                   | —                      |

#### `EarningsEvent`

```ts
interface EarningsEvent {
  symbol: string;
  date: Date;
  period?: string;
  epsActual?: number;
  epsEstimate?: number;
  epsSurprisePct?: number;
  revenueActual?: number;
  revenueEstimate?: number;
  provider: string;
  raw?: unknown;
}
```

#### `DividendEvent`

```ts
interface DividendEvent {
  symbol: string;
  exDate: Date;
  payDate?: Date;
  declaredDate?: Date;
  amount: number;
  currency: string;
  frequency?: "annual" | "semi-annual" | "quarterly" | "monthly" | "irregular";
  provider: string;
  raw?: unknown;
}
```

#### `SplitEvent`

```ts
interface SplitEvent {
  symbol: string;
  date: Date;
  ratio: number; // 4-for-1 forward split → 4; 1-for-10 reverse → 0.1
  description?: string;
  provider: string;
  raw?: unknown;
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

for await (const event of connect(provider, ["AAPL", "MSFT"], {
  signal: controller.signal,
})) {
  switch (event.type) {
    case "trade":
      console.log(
        `${event.trade.symbol}: $${event.trade.price} × ${event.trade.size}`
      );
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

| Provider                 | WebSocket        | Notes                                                                                         |
| ------------------------ | ---------------- | --------------------------------------------------------------------------------------------- |
| **PolygonProvider**      | Native WS        | `wss://socket.polygon.io/stocks` — auth via JSON handshake, subscribes to `T.*` trade channel |
| **FinnhubProvider**      | Native WS        | `wss://ws.finnhub.io?token=KEY` — per-symbol subscribe, batched trade messages                |
| **YahooProvider**        | Polling fallback | Polls `provider.quote()` every 5 s; emits `WsTrade` from quote data                           |
| **AlphaVantageProvider** | Polling fallback | Same as Yahoo                                                                                 |

The `connect()` function detects provider capability automatically — no configuration required.

#### `WsEvent` union

| `type`           | Payload                               | When                                 |
| ---------------- | ------------------------------------- | ------------------------------------ |
| `"connected"`    | `provider: string`                    | WS opened (and after each reconnect) |
| `"trade"`        | `trade: WsTrade`                      | Each trade tick                      |
| `"disconnected"` | `provider`, `reconnecting`, `attempt` | WS closed unexpectedly               |
| `"error"`        | `error`, `recoverable`                | Protocol or network error            |

#### `WsTrade`

```ts
interface WsTrade {
  symbol: string;
  price: number;
  size: number; // shares / units
  timestamp: Date;
  conditions?: number[]; // provider-specific condition codes
}
```

#### `WsOptions`

| Option                 | Type                          | Default                | Description                                |
| ---------------------- | ----------------------------- | ---------------------- | ------------------------------------------ |
| `wsImpl`               | `typeof globalThis.WebSocket` | `globalThis.WebSocket` | Custom WS constructor for Node 18–20       |
| `maxReconnectAttempts` | `number`                      | `10`                   | Reconnect attempts before closing          |
| `reconnectDelayMs`     | `number`                      | `1000`                 | Base delay (doubles per attempt, max 30 s) |
| `signal`               | `AbortSignal`                 | —                      | Stop the stream                            |

#### Node 18–20 compatibility

Node 21+ exposes `WebSocket` globally. For Node 18/20, install the `ws` package and inject it:

```ts
import WebSocket from "ws";
connect(provider, ["AAPL"], {
  wsImpl: WebSocket as unknown as typeof globalThis.WebSocket,
});
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
