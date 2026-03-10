---
layout: home

hero:
  name: "market-feed"
  text: "Unified financial market data"
  tagline: One TypeScript client for Yahoo Finance, Alpha Vantage & Polygon.io — with caching and automatic fallback.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/piyushgupta344/market-feed

features:
  - icon: 🔌
    title: Three providers, one interface
    details: Yahoo Finance (free), Alpha Vantage (25/day free), and Polygon.io (delayed free). All return the same Quote, HistoricalBar, and CompanyProfile shapes.

  - icon: ⚡
    title: Built-in LRU cache
    details: Responses are cached automatically with smart per-method TTLs. Pluggable driver lets you swap in Redis, Upstash, or any key-value store.

  - icon: 🔄
    title: Automatic failover
    details: Configure a provider chain and market-feed will silently try the next one if the first fails or hits a rate limit.

  - icon: 🦾
    title: Strict TypeScript
    details: No any. Every response is fully typed with complete autocomplete. Works the same in Node 18, Bun, Deno, and Cloudflare Workers.

  - icon: 📦
    title: Zero production dependencies
    details: Uses only the native fetch API. 38 KB ESM bundle. Tree-shakable — import only the providers you need.

  - icon: 🔓
    title: Escape hatch
    details: Pass { raw: true } to any method to get the original provider response alongside the normalised data.
---

## Quickstart

```bash
npm install market-feed
```

```ts
import { MarketFeed } from "market-feed";

const feed = new MarketFeed(); // zero-config, Yahoo Finance, no API key

const quote = await feed.quote("AAPL");
console.log(`${quote.symbol}: $${quote.price.toFixed(2)}`);
// AAPL: $189.84
```

That's it. No API keys, no boilerplate.
