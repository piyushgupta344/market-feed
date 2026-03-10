# What is market-feed?

**market-feed** is a TypeScript library that provides a unified interface to free financial market data APIs.

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

One interface. Three providers. Cache, retry, fallback — all built in.

## Design goals

| Goal | How |
|------|-----|
| **Consistent types** | Every provider returns the same `Quote`, `HistoricalBar`, `CompanyProfile` shape |
| **Zero dependencies** | Uses native `fetch` — runs in Node, Bun, Deno, CF Workers without polyfills |
| **Strict TypeScript** | No `any`. Full inference. Works with `strict: true` |
| **Smart defaults** | Works out-of-the-box with Yahoo Finance — no API key required |
| **Transparent** | `raw: true` exposes the original provider response when you need it |

## What market-feed is NOT

- A **real-time streaming** library (use WebSockets or SSE for that)
- A **paid data service** — it wraps free APIs that have rate limits and data delays
- A browser library — financial APIs block CORS; run market-feed server-side
- A **trading platform** — the data is for informational use only
