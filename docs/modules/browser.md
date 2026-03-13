# Browser Bundle

`market-feed/browser` is a browser-native build of the full `market-feed` API — no Node.js dependencies required. All providers use the native browser `fetch` and `WebSocket` APIs, making it suitable for direct use in browsers without a bundler.

It also ships CORS proxy utilities to work around the fact that most financial data providers do not send CORS headers.

## Installation

```bash
npm install market-feed
```

No additional packages needed. The browser build tree-shakes automatically.

## Basic usage

```ts
import { MarketFeed, YahooProvider, createFetchWithProxy } from "market-feed/browser";

// In development — route all requests through a CORS proxy
const proxiedFetch = createFetchWithProxy("https://corsproxy.io/?");

const feed = new MarketFeed({
  providers: [new YahooProvider({ fetchFn: proxiedFetch })],
});

const quote = await feed.quote("AAPL");
console.log(quote.price);
```

In production, proxy API calls through your own server instead of a public CORS proxy.

## What's included

`market-feed/browser` re-exports the **complete** `market-feed` API plus the WebSocket streaming module:

- Everything from `market-feed` — `MarketFeed`, all providers, types, errors
- `connect` and `getOrderBook` from `market-feed/ws`
- CORS proxy utilities: `createFetchWithProxy`, `installCorsProxy`

## CORS note

Most financial data providers (Yahoo Finance, Polygon, Finnhub, etc.) do not send `Access-Control-Allow-Origin` headers. Direct browser requests to these APIs are blocked by the browser's CORS policy.

**Solutions:**

| Approach | Use case |
|----------|----------|
| Public CORS proxy (e.g. `corsproxy.io`) | Development / prototyping only |
| Self-hosted CORS proxy | Small-scale production |
| Server-side API route | Production apps — proxy calls through your own backend |
| Tiingo / Twelve Data (CORS-enabled) | Some providers send CORS headers on paid plans |

## `createFetchWithProxy`

Creates a `fetch`-compatible function that routes all HTTP requests through a CORS proxy. Pass the returned function as `fetchFn` to any provider.

```ts
import { createFetchWithProxy, YahooProvider, MarketFeed } from "market-feed/browser";

const proxiedFetch = createFetchWithProxy("https://corsproxy.io/?");

const feed = new MarketFeed({
  providers: [new YahooProvider({ fetchFn: proxiedFetch })],
});
```

### Supported proxy URL formats

| Proxy | URL prefix |
|-------|-----------|
| [corsproxy.io](https://corsproxy.io) | `"https://corsproxy.io/?"` |
| [allorigins](https://allorigins.win) | `"https://api.allorigins.win/raw?url="` |
| Self-hosted | `"https://your-proxy.example.com/proxy?url="` |

The function encodes the original URL with `encodeURIComponent` before appending it to the proxy prefix, so query parameters are preserved correctly.

### Signature

```ts
function createFetchWithProxy(proxyUrl: string): typeof globalThis.fetch
```

## `installCorsProxy`

Patches `globalThis.fetch` to route **all** requests in your app through a CORS proxy — not just market-feed requests.

Useful during development when you want every `fetch()` call to go through the proxy automatically.

```ts
import { installCorsProxy } from "market-feed/browser";

// Install — all fetch() calls now go through the proxy
const uninstall = installCorsProxy("https://corsproxy.io/?");

// ... your app code ...

// Restore the original fetch when done
uninstall();
```

### Signature

```ts
function installCorsProxy(proxyUrl: string): () => void
```

Returns a cleanup function that restores the original `fetch` when called. Always call the returned function in cleanup (e.g. `useEffect` return, `beforeEach`/`afterEach` in tests) to avoid leaking the proxy to other code.

## Provider `fetchFn` option

Every provider accepts a `fetchFn` option that replaces the global `fetch` for that provider only. This is the recommended approach for production use:

```ts
import {
  MarketFeed,
  YahooProvider,
  PolygonProvider,
  FinnhubProvider,
  AlphaVantageProvider,
  TiingoProvider,
  TwelveDataProvider,
  createFetchWithProxy,
} from "market-feed/browser";

const proxyFetch = createFetchWithProxy("https://corsproxy.io/?");

const feed = new MarketFeed({
  providers: [
    new YahooProvider({ fetchFn: proxyFetch }),
    new PolygonProvider({ apiKey: "...", fetchFn: proxyFetch }),
    new FinnhubProvider({ apiKey: "...", fetchFn: proxyFetch }),
  ],
});
```

## WebSocket streaming in the browser

`market-feed/ws` uses `globalThis.WebSocket` by default, which is available natively in all modern browsers. No `wsImpl` option is needed.

```ts
import { connect, MarketFeed, FinnhubProvider, createFetchWithProxy } from "market-feed/browser";

const proxyFetch = createFetchWithProxy("https://corsproxy.io/?");
const provider = new FinnhubProvider({ apiKey: "...", fetchFn: proxyFetch });

const controller = new AbortController();

for await (const event of connect(provider, ["AAPL", "MSFT"], {
  signal: controller.signal,
  // No wsImpl needed — browser WebSocket is available globally
})) {
  if (event.type === "trade") {
    console.log(`${event.trade.symbol}: $${event.trade.price}`);
  }
}
```

## Using with a bundler

When using Vite, webpack, or another bundler, import from `market-feed` directly (not `market-feed/browser`) — bundlers handle tree-shaking and platform-specific code automatically. The `market-feed/browser` subpath is primarily useful for:

- Direct `<script type="module">` usage in HTML
- CDN-based delivery (e.g. `jsDelivr`, `unpkg`, `esm.sh`)
- Environments where you want a single self-contained browser import

```html
<!-- Via CDN — no install needed -->
<script type="module">
  import { MarketFeed, YahooProvider, createFetchWithProxy } from "https://esm.sh/market-feed/browser";

  const proxyFetch = createFetchWithProxy("https://corsproxy.io/?");
  const feed = new MarketFeed({
    providers: [new YahooProvider({ fetchFn: proxyFetch })],
  });

  const quote = await feed.quote("AAPL");
  document.getElementById("price").textContent = `$${quote.price.toFixed(2)}`;
</script>
```
