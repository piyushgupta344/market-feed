# Providers

market-feed ships with six built-in providers. Each implements the same `MarketProvider` interface so you can swap or combine them without changing your application code.

## Provider comparison

| Provider | API Key | Quote | Historical | Search | Company | News | Fundamentals | Free tier |
|----------|:-------:|:-----:|:----------:|:------:|:-------:|:----:|:------------:|-----------|
| **Yahoo Finance** | No | ✓ | ✓ | ✓ | ✓ | — | ✓ | Unlimited (unofficial) |
| **Alpha Vantage** | Yes | ✓ | ✓ | ✓ | ✓ | — | — | 25 calls/day, 5/min |
| **Polygon.io** | Yes | ✓ | ✓ | ✓ | ✓ | ✓ | — | 5 calls/min, 15-min delay |
| **Finnhub** | Yes | ✓ | ✓ | ✓ | ✓ | ✓ | — | 60 calls/min |
| **Twelve Data** | Yes | ✓ | ✓ | ✓ | ✓ | — | — | 800 calls/day, 8/min |
| **Tiingo** | Yes | ✓ | ✓ | ✓ | ✓ | ✓ | — | 1 000 calls/day |

Get free keys: [Alpha Vantage](https://www.alphavantage.co/support/#api-key) · [Polygon.io](https://polygon.io/) · [Finnhub](https://finnhub.io/) · [Twelve Data](https://twelvedata.com/) · [Tiingo](https://www.tiingo.com/)

---

## Yahoo Finance

The default provider. No API key required.

```ts
import { MarketFeed, YahooProvider } from "market-feed";

const feed = new MarketFeed({
  providers: [new YahooProvider()],
});
```

### Options

```ts
new YahooProvider({
  timeoutMs: 10_000,  // request timeout, default 10s
  retries: 2,         // retry attempts on transient failures, default 2
});
```

### Unique features

Yahoo is the only built-in provider that supports **financial statements** (income statement, balance sheet, cash flow) via `market-feed/fundamentals`.

### Notes

- Uses the unofficial `query1.finance.yahoo.com` API — not endorsed by Yahoo
- Cannot run in the browser (CORS blocked) — use server-side only
- If a stock is delisted, Yahoo removes its historical data retroactively

---

## Alpha Vantage

Free: 25 API calls/day, 5 calls/minute. Paid plans available.

```ts
import { MarketFeed, AlphaVantageProvider } from "market-feed";

const feed = new MarketFeed({
  providers: [
    new AlphaVantageProvider({ apiKey: process.env.AV_KEY! }),
  ],
});
```

### Options

```ts
new AlphaVantageProvider({
  apiKey: "YOUR_KEY",     // required
  timeoutMs: 10_000,
  retries: 2,
  rateLimiter: myLimiter, // override built-in rate limiter
});
```

### Rate limiting

The built-in rate limiter enforces 5 calls/minute client-side. When the limit is hit, a `RateLimitError` is thrown with a `retryAfter` date.

If you have a premium plan, pass a custom `RateLimiter`:

```ts
import { RateLimiter } from "market-feed";

new AlphaVantageProvider({
  apiKey: process.env.AV_KEY!,
  rateLimiter: new RateLimiter("alpha-vantage", 75, 75 / 60), // 75/min premium
});
```

---

## Polygon.io

Free tier: 15-minute delayed data, 5 calls/minute.

```ts
import { MarketFeed, PolygonProvider } from "market-feed";

const feed = new MarketFeed({
  providers: [
    new PolygonProvider({ apiKey: process.env.POLYGON_KEY! }),
  ],
});
```

### Unique features

- Supports **news**: `feed.news("AAPL")`
- Supports **WebSocket streaming** via `market-feed/ws` (paid real-time plan, or delayed on free)

---

## Finnhub

Free: 60 API calls/minute.

```ts
import { MarketFeed, FinnhubProvider } from "market-feed";

const feed = new MarketFeed({
  providers: [
    new FinnhubProvider({ apiKey: process.env.FINNHUB_KEY! }),
  ],
});
```

### Unique features

- Supports **news**: `feed.news("AAPL")`
- Supports **WebSocket streaming** via `market-feed/ws`
- Supports **earnings, dividends, splits**

---

## Twelve Data

Free: 800 API calls/day, 8 calls/minute. Good for crypto and forex in addition to stocks.

```ts
import { MarketFeed, TwelveDataProvider } from "market-feed";

const feed = new MarketFeed({
  providers: [
    new TwelveDataProvider({ apiKey: process.env.TD_KEY! }),
  ],
});
```

### Symbol format

Twelve Data uses `/` as a separator for forex and crypto pairs. market-feed converts automatically:

| Input | Sent to Twelve Data |
|-------|---------------------|
| `BTC-USD` | `BTC/USD` |
| `EURUSD=X` | `EUR/USD` |
| `AAPL` | `AAPL` |

---

## Tiingo

Free: 1 000 API calls/day. Provides adjusted close prices in historical data.

```ts
import { MarketFeed, TiingoProvider } from "market-feed";

const feed = new MarketFeed({
  providers: [
    new TiingoProvider({ apiKey: process.env.TIINGO_KEY! }),
  ],
});
```

### Authentication

Tiingo uses `Authorization: Token KEY` header authentication.

### Unique features

- Historical bars include `adjClose` (split- and dividend-adjusted)
- Supports **news**

---

## Using multiple providers

Provide an array in priority order. With `fallback: true` (default), market-feed tries each provider until one succeeds:

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
    new YahooProvider(),                                              // free, no key
    new AlphaVantageProvider({ apiKey: process.env.AV_KEY! }),       // fallback 1
    new PolygonProvider({ apiKey: process.env.POLYGON_KEY! }),       // fallback 2
    new FinnhubProvider({ apiKey: process.env.FINNHUB_KEY! }),       // fallback 3
    new TwelveDataProvider({ apiKey: process.env.TD_KEY! }),         // fallback 4
    new TiingoProvider({ apiKey: process.env.TIINGO_KEY! }),         // fallback 5
  ],
  fallback: true,
});
```

Read more in [Fallback & Reliability](/guide/fallback).
