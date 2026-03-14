# Getting Started

## Installation

::: code-group

```bash [npm]
npm install market-feed
```

```bash [pnpm]
pnpm add market-feed
```

```bash [bun]
bun add market-feed
```

```bash [yarn]
yarn add market-feed
```

```bash [Deno (JSR)]
deno add jsr:@piyushgupta344/market-feed
```

:::

## Requirements

- **Node.js** 20+ (uses native `fetch`)
- **TypeScript** 5+ (recommended, but not required)

## Your first quote

```ts
import { MarketFeed } from "market-feed";

const feed = new MarketFeed();

const quote = await feed.quote("AAPL");
console.log(`${quote.symbol}: $${quote.price.toFixed(2)}`);
// AAPL: $189.84
```

No API key required — the default provider is Yahoo Finance.

## Multiple quotes

```ts
const quotes = await feed.quote(["AAPL", "MSFT", "GOOGL", "AMZN"]);

for (const q of quotes) {
  const sign = q.changePercent >= 0 ? "▲" : "▼";
  console.log(`${q.symbol} ${sign} ${Math.abs(q.changePercent).toFixed(2)}%`);
}
```

## Historical data

```ts
const bars = await feed.historical("AAPL", {
  period1: "2024-01-01",
  period2: "2024-12-31",
  interval: "1d",
});

console.log(`Fetched ${bars.length} daily bars`);
console.log(`First: ${bars[0]?.date.toDateString()} close=$${bars[0]?.close}`);
```

## Search for a ticker

```ts
const results = await feed.search("Tesla");

for (const r of results) {
  console.log(`${r.symbol} — ${r.name} (${r.type})`);
}
// TSLA — Tesla, Inc. (stock)
// TSLA.MX — Tesla, Inc. (stock)
```

## Company profile

```ts
const profile = await feed.company("AAPL");

console.log(profile.name);        // Apple Inc.
console.log(profile.sector);      // Technology
console.log(profile.employees);   // 164000
console.log(profile.marketCap);   // 2900000000000
```

## News

::: info
News requires a Polygon.io API key. See [Providers](/guide/providers).
:::

```ts
import { MarketFeed, PolygonProvider } from "market-feed";

const feed = new MarketFeed({
  providers: [new PolygonProvider({ apiKey: process.env.POLYGON_KEY! })],
});

const articles = await feed.news("AAPL", { limit: 5 });

for (const article of articles) {
  console.log(`[${article.source}] ${article.title}`);
  console.log(`  ${article.url}`);
}
```

## Next steps

- Learn about [Providers](/guide/providers) — add Alpha Vantage or Polygon
- Set up [Caching](/guide/caching) for production use
- Configure [Fallback](/guide/fallback) for resilience
- Handle [Errors](/guide/errors) gracefully
