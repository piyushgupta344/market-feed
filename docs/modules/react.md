# React Hooks

`market-feed/react` provides five hooks for integrating live market data into React and React Native applications.

## Installation

React 18 or later is required as a peer dependency:

```bash
npm install market-feed react
```

## `useQuote`

Fetches a live quote for a single symbol, polling at a configurable interval.

```tsx
import { useQuote } from "market-feed/react";
import { MarketFeed } from "market-feed";

const feed = new MarketFeed();

function StockTicker({ symbol }: { symbol: string }) {
  const { data, loading, error } = useQuote(feed, symbol, { intervalMs: 10_000 });

  if (loading) return <span>Loading…</span>;
  if (error)   return <span>Error: {error.message}</span>;

  return (
    <div>
      <strong>{data?.symbol}</strong> ${data?.price.toFixed(2)}
      {" "}
      <span style={{ color: (data?.changePercent ?? 0) >= 0 ? "green" : "red" }}>
        {data?.changePercent.toFixed(2)}%
      </span>
    </div>
  );
}
```

### Options

```ts
interface UseQuoteOptions {
  /** Poll interval in milliseconds. Default: 30 000 */
  intervalMs?: number;
  /** Skip fetching when false. Default: true */
  enabled?: boolean;
}
```

### Return value

```ts
interface UseQuoteResult {
  data: Quote | null;
  loading: boolean;
  error: Error | null;
}
```

The hook re-fetches automatically whenever `symbol`, `intervalMs`, or `enabled` changes. A fresh fetch fires immediately on mount and on each symbol change — the interval counter resets.

---

## `useStream`

Subscribes to a live event stream via `watch()` from `market-feed/stream`. Yields `QuoteEvent`, `MarketOpenEvent`, and `DivergenceEvent` objects.

```tsx
import { useStream } from "market-feed/react";
import { MarketFeed } from "market-feed";
import type { QuoteEvent } from "market-feed/stream";

const feed = new MarketFeed();

function LivePrices({ symbols }: { symbols: string[] }) {
  const { event, error } = useStream(feed, symbols);

  if (!event) return <p>Waiting for data…</p>;

  if (event.type === "quote") {
    const q = (event as QuoteEvent).quote;
    return <p>{q.symbol}: ${q.price.toFixed(2)}</p>;
  }

  if (event.type === "market_open") return <p>Market opened</p>;
  if (event.type === "market_close") return <p>Market closed</p>;

  return null;
}
```

### Options

```ts
interface UseStreamOptions {
  /** Poll interval in ms when market is open. Default: 5 000 */
  intervalMs?: number;
  /** Multiplier applied to intervalMs when market is closed. Default: 60 */
  closedMultiplier?: number;
  /** Exchange to check for market hours. Default: "NYSE" */
  exchange?: string;
  /** Whether to skip off-hours polling. Default: true */
  respectMarketHours?: boolean;
}
```

### Return value

```ts
interface UseStreamResult {
  event: WatchEvent | null;
  error: Error | null;
}
```

The stream restarts automatically whenever `feed` reference or the `symbols` list (compared by content) changes. An `AbortController` is used for cleanup on unmount.

---

## `useAlerts`

Runs `watchAlerts()` and accumulates fired `AlertEvent` objects.

```tsx
import { useAlerts } from "market-feed/react";
import type { AlertConfig } from "market-feed/alerts";
import { MarketFeed } from "market-feed";

const feed = new MarketFeed();

const alerts: AlertConfig[] = [
  { symbol: "AAPL", condition: { type: "price_above", threshold: 200 }, once: true },
  { symbol: "TSLA", condition: { type: "change_pct_below", threshold: -5 }, debounceMs: 300_000 },
];

function AlertLog() {
  const { events, error } = useAlerts(feed, alerts, { intervalMs: 10_000 });

  return (
    <ul>
      {events.map((ev, i) => (
        <li key={i}>
          [{ev.triggeredAt.toLocaleTimeString()}] {ev.alert.symbol}{" "}
          {ev.alert.condition.type} — ${ev.quote.price.toFixed(2)}
        </li>
      ))}
    </ul>
  );
}
```

### Options

```ts
interface AlertsOptions {
  /** Poll interval in milliseconds. Default: 5 000 */
  intervalMs?: number;
}
```

### Return value

```ts
interface UseAlertsResult {
  events: AlertEvent[];   // accumulates over component lifetime
  error: Error | null;
}
```

Fired events accumulate in the `events` array — they are never removed. The generator restarts (and `events` is cleared) whenever the alerts list changes (compared by content).

---

## `useWebSocket`

Subscribes to a real-time WebSocket stream via `connect()` from `market-feed/ws`. Works on React Native — `WebSocket` is available natively in all RN versions.

```tsx
import { useWebSocket } from "market-feed/react";
import { FinnhubProvider } from "market-feed";

const provider = new FinnhubProvider({ apiKey: process.env.EXPO_PUBLIC_FINNHUB_KEY! });

function LiveTrades({ symbols }: { symbols: string[] }) {
  const { event, latestTrade, error } = useWebSocket(provider, symbols);

  if (error) return <Text>Stream error: {error.message}</Text>;
  if (!latestTrade) return <Text>Connecting…</Text>;

  return (
    <Text>
      {latestTrade.symbol}: ${latestTrade.price.toFixed(2)} × {latestTrade.size}
    </Text>
  );
}
```

### Options

```ts
interface WsOptions {
  /** Custom WebSocket constructor (for Node 18–20). Not needed in React Native. */
  wsImpl?: typeof globalThis.WebSocket;
  /** Max reconnect attempts. Default: 10 */
  maxReconnectAttempts?: number;
  /** Base reconnect delay in ms. Default: 1000 */
  reconnectDelayMs?: number;
}
```

### Return value

```ts
interface UseWebSocketResult {
  /** The latest WsEvent (trade, connected, disconnected, error) — or null. */
  event: WsEvent | null;
  /** Shortcut for the most recent trade, or null before the first trade arrives. */
  latestTrade: WsTrade | null;
  /** Fatal error if the stream throws unexpectedly. */
  error: Error | null;
}
```

The stream restarts automatically when the `symbols` list changes. It is stopped on unmount via an internal `AbortSignal`.

---

## `useOrderBook`

Subscribes to top-of-book bid/ask updates via `getOrderBook()` from `market-feed/ws`. Works on React Native.

```tsx
import { useOrderBook } from "market-feed/react";
import { PolygonProvider } from "market-feed";

const provider = new PolygonProvider({ apiKey: process.env.EXPO_PUBLIC_POLYGON_KEY! });

function OrderBook({ symbol }: { symbol: string }) {
  const { orderBook, error } = useOrderBook(provider, symbol);

  if (error) return <Text>Error: {error.message}</Text>;
  if (!orderBook) return <Text>Waiting for quotes…</Text>;

  const bid = orderBook.bids[0];
  const ask = orderBook.asks[0];

  return (
    <View>
      <Text>Bid: ${bid?.price.toFixed(2)} × {bid?.size}</Text>
      <Text>Ask: ${ask?.price.toFixed(2)} × {ask?.size}</Text>
    </View>
  );
}
```

### Supported providers

| Provider | Data source |
|----------|-------------|
| `PolygonProvider` | Native WS — `Q.*` NBBO quotes |
| `AlpacaProvider` | Native WS — quotes channel |
| `IbTwsProvider` | Native WS — bid/ask fields |
| All others | Polling fallback — synthesises spread from `quote()` |

### Return value

```ts
interface UseOrderBookResult {
  /** Latest top-of-book snapshot, or null before the first update. */
  orderBook: OrderBookEvent | null;
  /** Fatal error if the generator throws unexpectedly. */
  error: Error | null;
}
```

---

## Stable references

All three hooks keep refs to `source`/`feed` and `options` internally, so passing a new object reference on every render does **not** restart the subscription. Only changes to key values (`symbol`, `symbols` content, `alerts` content, `intervalMs`, `enabled`) trigger a restart.

```tsx
// Safe: new object each render, but key values unchanged → no restart
const { data } = useQuote(feed, "AAPL", { intervalMs: 10_000 });

// Triggers restart: symbol changed
const { data } = useQuote(feed, ticker, { intervalMs: 10_000 });
```

---

## Server-side rendering

The hooks are client-only. When rendering in a server environment (Next.js App Router, Remix), guard with `"use client"` or dynamic imports:

```tsx
// components/Ticker.tsx
"use client";

import { useQuote } from "market-feed/react";
// ...
```

Or with Next.js dynamic imports:

```tsx
const Ticker = dynamic(() => import("./Ticker"), { ssr: false });
```

---

## Using a single provider

Like other modules, the hooks accept any object with a `quote()` method — not just `MarketFeed`:

```tsx
import { YahooProvider } from "market-feed";

const yahoo = new YahooProvider();
const { data } = useQuote(yahoo, "AAPL");
```

---

## React Native

All five hooks work in React Native (Expo and bare workflow). React Native provides `fetch`, `WebSocket`, and `AbortController` natively, so no polyfills are needed on modern versions.

### Setup (Expo)

```bash
npx expo install market-feed react
```

```tsx
import { useQuote, useWebSocket } from "market-feed/react";
import { FinnhubProvider } from "market-feed";

const provider = new FinnhubProvider({
  apiKey: process.env.EXPO_PUBLIC_FINNHUB_KEY!,
});

export default function App() {
  const { data } = useQuote(provider, "AAPL", { intervalMs: 10_000 });
  const { latestTrade } = useWebSocket(provider, ["AAPL", "MSFT", "TSLA"]);

  return (
    <View>
      <Text>REST: ${data?.price.toFixed(2)}</Text>
      <Text>WS: ${latestTrade?.price.toFixed(2)}</Text>
    </View>
  );
}
```

### AbortController

`AbortController` is available natively since React Native 0.71. For older versions, install the polyfill:

```bash
npm install abortcontroller-polyfill
```

```ts
// index.js — before any other imports
import "abortcontroller-polyfill/dist/abortcontroller-polyfill-only";
```

### Metro bundler

No special Metro config is needed. `market-feed` ships both ESM and CJS, and Metro resolves CJS by default.
