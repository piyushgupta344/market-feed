# market-feed

> Unified TypeScript client for financial market data.
> Wraps Yahoo Finance, Alpha Vantage, and Polygon.io under one consistent interface — with caching and automatic fallback built in.

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

One interface. Three providers. Zero API key required for Yahoo Finance.

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

| Provider | API Key | Quote | Historical | Search | Company | News | Market Status |
|----------|---------|:-----:|:----------:|:------:|:-------:|:----:|:-------------:|
| **Yahoo Finance** | Not required | ✓ | ✓ | ✓ | ✓ | — | — |
| **Alpha Vantage** | Free (25/day) | ✓ | ✓ | ✓ | ✓ | — | — |
| **Polygon.io** | Free (delayed) | ✓ | ✓ | ✓ | ✓ | ✓ | — |

Get free keys: [Alpha Vantage](https://www.alphavantage.co/support/#api-key) · [Polygon.io](https://polygon.io/)

### Using multiple providers

```ts
import {
  MarketFeed,
  YahooProvider,
  AlphaVantageProvider,
  PolygonProvider,
} from "market-feed";

const feed = new MarketFeed({
  providers: [
    new YahooProvider(),
    new AlphaVantageProvider({ apiKey: process.env.AV_KEY }),
    new PolygonProvider({ apiKey: process.env.POLYGON_KEY }),
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
| Node.js | 18+ | Requires native `fetch` (available since Node 18) |
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

This library is not affiliated with or endorsed by Yahoo Finance, Alpha Vantage, or Polygon.io. Data is provided for informational purposes only and should not be used as the sole basis for investment decisions.

---

## License

[MIT](LICENSE)
