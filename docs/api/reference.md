# API Reference

## MarketFeed

The main class. Wraps providers with caching and fallback.

### Constructor

```ts
new MarketFeed(options?: MarketFeedOptions)
```

```ts
interface MarketFeedOptions {
  /**
   * Ordered provider chain.
   * Default: [new YahooProvider()]
   */
  providers?: MarketProvider[];

  /**
   * Cache configuration.
   * Pass false to disable entirely.
   * Default: in-memory LRU with 60s TTL.
   */
  cache?: CacheConfig | false;

  /**
   * Auto-failover to next provider on error.
   * Default: true
   */
  fallback?: boolean;
}
```

---

### `quote(symbol, options?)`

Fetch the latest quote for a single symbol.

```ts
feed.quote(symbol: string, options?: QuoteOptions): Promise<Quote>
```

### `quote(symbols, options?)`

Fetch quotes for multiple symbols in one call. Providers may execute them in parallel.

```ts
feed.quote(symbols: string[], options?: QuoteOptions): Promise<Quote[]>
```

```ts
interface QuoteOptions {
  /** Include the raw provider response on each Quote object */
  raw?: boolean;
}
```

---

### `historical(symbol, options?)`

Fetch OHLCV bars for a symbol over a date range.

```ts
feed.historical(symbol: string, options?: HistoricalOptions): Promise<HistoricalBar[]>
```

```ts
interface HistoricalOptions {
  /** Start date. Default: 1 year ago. */
  period1?: string | Date;
  /** End date. Default: today. */
  period2?: string | Date;
  /** Bar interval. Default: "1d". */
  interval?: HistoricalInterval;
  raw?: boolean;
}

type HistoricalInterval =
  | "1m" | "2m" | "5m" | "15m" | "30m" | "60m" | "90m" | "1h"
  | "1d" | "5d" | "1wk" | "1mo" | "3mo";
```

---

### `search(query, options?)`

Search for ticker symbols matching a query string.

```ts
feed.search(query: string, options?: SearchOptions): Promise<SearchResult[]>
```

```ts
interface SearchOptions {
  /** Maximum results to return. Default: 10. */
  limit?: number;
  raw?: boolean;
}
```

---

### `company(symbol, options?)`

Fetch company or asset profile.

::: info
Not all providers support this. With `fallback: true`, market-feed tries each provider in order until one succeeds.
:::

```ts
feed.company(symbol: string, options?: CompanyOptions): Promise<CompanyProfile>
```

---

### `news(symbol, options?)`

Fetch recent news articles for a symbol.

::: info
Currently only supported by Polygon.io.
:::

```ts
feed.news(symbol: string, options?: NewsOptions): Promise<NewsItem[]>
```

```ts
interface NewsOptions {
  /** Maximum articles to return. Default: 10. */
  limit?: number;
  raw?: boolean;
}
```

---

### `marketStatus(market?, options?)`

Get the current trading session status.

```ts
feed.marketStatus(market?: string, options?: MarketStatusOptions): Promise<MarketStatus>
```

---

### `earnings(symbol, options?)`

Fetch historical EPS actuals vs. analyst estimates.

```ts
feed.earnings(symbol: string, options?: EarningsOptions): Promise<EarningsEvent[]>
```

---

### `dividends(symbol, options?)`

Fetch cash dividend history.

```ts
feed.dividends(symbol: string, options?: DividendOptions): Promise<DividendEvent[]>
```

---

### `splits(symbol, options?)`

Fetch stock split history.

```ts
feed.splits(symbol: string, options?: SplitOptions): Promise<SplitEvent[]>
```

---

### `incomeStatements(symbol, options?)`

Fetch annual or quarterly income statements.

```ts
feed.incomeStatements(symbol: string, options?: FundamentalsOptions): Promise<IncomeStatement[]>
```

---

### `balanceSheets(symbol, options?)`

Fetch annual or quarterly balance sheets.

```ts
feed.balanceSheets(symbol: string, options?: FundamentalsOptions): Promise<BalanceSheet[]>
```

---

### `cashFlows(symbol, options?)`

Fetch annual or quarterly cash flow statements.

```ts
feed.cashFlows(symbol: string, options?: FundamentalsOptions): Promise<CashFlowStatement[]>
```

```ts
interface FundamentalsOptions {
  /** Return quarterly periods instead of annual. Default: false. */
  quarterly?: boolean;
  /** Max number of periods to return. */
  limit?: number;
  raw?: boolean;
}
```

---

### `optionChain(symbol, options?)`

Fetch an options chain for a symbol. Requires a provider that supports options (currently Polygon.io).

```ts
feed.optionChain(symbol: string, options?: OptionChainOptions): Promise<OptionChain>
```

```ts
interface OptionChainOptions {
  expiry?: string;       // filter to specific expiry, e.g. "2024-07-19"
  strike?: number;       // exact strike filter
  strikeLow?: number;    // min strike
  strikeHigh?: number;   // max strike
  type?: "call" | "put"; // both by default
  limit?: number;        // max contracts (default 50)
  raw?: boolean;
}
```

Cache TTL: 60 seconds.

---

### `clearCache()`

Remove all cached entries.

```ts
feed.clearCache(): Promise<void>
```

---

### `invalidate(key)`

Remove a specific cache entry by key.

```ts
feed.invalidate(key: string): Promise<void>
```

---

## Data Types

### Quote

```ts
interface Quote {
  symbol: string;          // "AAPL"
  name: string;            // "Apple Inc."
  price: number;           // 189.84
  change: number;          // 1.52
  changePercent: number;   // 0.807 (percent, not decimal)
  open: number;
  high: number;
  low: number;
  close: number;
  previousClose: number;
  volume: number;
  avgVolume?: number;
  marketCap?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  currency: string;        // "USD"
  exchange: string;        // "NasdaqGS"
  timestamp: Date;
  provider: string;        // "yahoo" | "alpha-vantage" | "polygon"
  raw?: unknown;           // original provider response (if raw:true)
}
```

### HistoricalBar

```ts
interface HistoricalBar {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose?: number;  // adjusted for splits and dividends
  volume: number;
  raw?: unknown;
}
```

### CompanyProfile

```ts
interface CompanyProfile {
  symbol: string;
  name: string;
  description?: string;
  sector?: string;
  industry?: string;
  country?: string;
  employees?: number;
  website?: string;
  ceo?: string;
  marketCap?: number;
  peRatio?: number;
  forwardPE?: number;
  priceToBook?: number;
  dividendYield?: number;  // decimal — 0.015 = 1.5%
  beta?: number;
  exchange?: string;
  currency?: string;
  ipoDate?: Date;
  esg?: EsgScores;         // populated when provider returns ESG data
  provider: string;
  raw?: unknown;
}

interface EsgScores {
  totalScore?: number;        // overall ESG score (0–100)
  environmentScore?: number;  // environmental pillar
  socialScore?: number;       // social pillar
  governanceScore?: number;   // governance pillar
  percentile?: number;        // rank within peer group
  peerGroup?: string;         // e.g. "Technology Hardware"
  esgPerformance?: string;    // "OUT_PERF" | "AVG_PERF" | "UNDER_PERF" | "LAG_PERF"
}
```

### NewsItem

```ts
interface NewsItem {
  id: string;
  title: string;
  summary?: string;
  url: string;
  source: string;
  publishedAt: Date;
  symbols: string[];    // tickers mentioned
  thumbnail?: string;
  provider: string;
  raw?: unknown;
}
```

### SearchResult

```ts
interface SearchResult {
  symbol: string;
  name: string;
  type: "stock" | "etf" | "crypto" | "forex" | "index"
      | "mutual-fund" | "future" | "unknown";
  exchange?: string;
  currency?: string;
  isin?: string;
  provider: string;
  raw?: unknown;
}
```

### MarketStatus

```ts
interface MarketStatus {
  isOpen: boolean;
  session: "pre" | "regular" | "post" | "closed";
  nextOpen?: Date;
  nextClose?: Date;
  market?: string;
  timezone?: string;
  provider: string;
  raw?: unknown;
}
```

---

## CacheConfig

```ts
interface CacheConfig {
  /** Default TTL in seconds. Default: 60. */
  ttl?: number;
  /** Max entries in memory cache. Default: 500. */
  maxSize?: number;
  /** Custom cache driver — overrides built-in LRU. */
  driver?: CacheDriver;
  /** Per-method TTL overrides. */
  ttlOverrides?: Partial<Record<CacheMethod, number>>;
}

type CacheMethod =
  | "quote" | "historical" | "company" | "news" | "search" | "marketStatus"
  | "earnings" | "dividends" | "splits"
  | "incomeStatements" | "balanceSheets" | "cashFlows";
```
