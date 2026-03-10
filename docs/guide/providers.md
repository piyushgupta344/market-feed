# Providers

market-feed ships with three built-in providers. Each implements the same `MarketProvider` interface so you can swap them without changing your application code.

## Provider comparison

| Provider | API Key | Quote | Historical | Search | Company | News | Free tier |
|----------|:-------:|:-----:|:----------:|:------:|:-------:|:----:|-----------|
| **Yahoo Finance** | No | ✓ | ✓ | ✓ | ✓ | — | Unlimited (unofficial) |
| **Alpha Vantage** | Yes | ✓ | ✓ | ✓ | ✓ | — | 25 calls/day, 5/min |
| **Polygon.io** | Yes | ✓ | ✓ | ✓ | ✓ | ✓ | 5 calls/min, 15-min delay |

Get free keys: [Alpha Vantage](https://www.alphavantage.co/support/#api-key) · [Polygon.io](https://polygon.io/)

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

### Notes

- Uses the unofficial `query1.finance.yahoo.com` API
- Not endorsed or officially supported by Yahoo
- If a stock is delisted, Yahoo removes its historical data retroactively
- Cannot run in the browser (CORS blocked) — use server-side only

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
  timeoutMs: 10_000,      // request timeout
  retries: 2,             // retry attempts
  rateLimiter: myLimiter, // override built-in rate limiter
});
```

### Rate limiting

The built-in rate limiter enforces 5 calls/minute client-side, preventing silent daily quota exhaustion. When the limit is hit, a `RateLimitError` is thrown with a `retryAfter` date.

If you have a premium plan with higher limits, pass a custom `RateLimiter`:

```ts
import { RateLimiter } from "market-feed";

const feed = new MarketFeed({
  providers: [
    new AlphaVantageProvider({
      apiKey: process.env.AV_KEY!,
      // 75 calls/min for premium tier
      rateLimiter: new RateLimiter("alpha-vantage", 75, 75 / 60),
    }),
  ],
});
```

---

## Polygon.io

Free tier delivers 15-minute delayed data with 5 calls/minute.

```ts
import { MarketFeed, PolygonProvider } from "market-feed";

const feed = new MarketFeed({
  providers: [
    new PolygonProvider({ apiKey: process.env.POLYGON_KEY! }),
  ],
});
```

### Options

```ts
new PolygonProvider({
  apiKey: "YOUR_KEY",     // required
  timeoutMs: 10_000,
  retries: 2,
  rateLimiter: myLimiter,
});
```

### Unique features

Polygon is the only built-in provider that supports **news**:

```ts
const articles = await feed.news("AAPL", { limit: 10 });
```

---

## Using multiple providers

Provide an array in priority order. With `fallback: true` (the default), market-feed tries each provider until one succeeds.

```ts
import { MarketFeed, YahooProvider, AlphaVantageProvider, PolygonProvider } from "market-feed";

const feed = new MarketFeed({
  providers: [
    new YahooProvider(),                                           // tried first, free
    new AlphaVantageProvider({ apiKey: process.env.AV_KEY! }),    // fallback 1
    new PolygonProvider({ apiKey: process.env.POLYGON_KEY! }),    // fallback 2
  ],
  fallback: true,
});
```

Read more in [Fallback & Reliability](/guide/fallback).
