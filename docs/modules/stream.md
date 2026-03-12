# HTTP Polling Stream

`market-feed/stream` provides a market-hours-aware async generator that polls quotes at configurable intervals. It pauses completely when the exchange is closed, emits session boundary events, and detects price divergence across providers.

## Basic usage

```ts
import { watch } from "market-feed/stream";
import { MarketFeed } from "market-feed";

const feed = new MarketFeed();
const controller = new AbortController();

for await (const event of watch(feed, ["AAPL", "MSFT"], {
  signal: controller.signal,
})) {
  if (event.type === "quote") {
    console.log(`${event.symbol}: $${event.quote.price}`);
  }
}

controller.abort(); // stop the stream
```

## Event types

All events share a `timestamp: Date` field.

### `quote`

```ts
{
  type: "quote";
  symbol: string;
  quote: Quote;
  timestamp: Date;
}
```

Emitted once per symbol per poll cycle.

### `market-open`

```ts
{
  type: "market-open";
  exchange: ExchangeId;
  session: "pre" | "regular";
  timestamp: Date;
}
```

Emitted when the stream detects a session transition from closed → open.

### `market-close`

```ts
{
  type: "market-close";
  exchange: ExchangeId;
  session: "post" | "closed";
  timestamp: Date;
}
```

### `divergence`

```ts
{
  type: "divergence";
  symbol: string;
  quotes: Quote[];        // one per responding provider
  spreadPct: number;      // (max - min) / mean × 100
  timestamp: Date;
}
```

Emitted when multiple providers return prices that differ by more than `divergenceThreshold` percent.

### `error`

```ts
{
  type: "error";
  error: Error;
  symbol?: string;
  recoverable: boolean;  // false = generator is about to terminate
  timestamp: Date;
}
```

### `earnings_released`

```ts
{
  type: "earnings_released";
  symbol: string;
  earnings: EarningsEvent;  // the newly detected quarterly report
  timestamp: Date;
}
```

Emitted when the stream detects a new quarterly earnings report for a watched symbol. Only emitted when `includeFundamentals: true`. Requires a provider with `earnings()` support (Yahoo Finance, Polygon).

```ts
for await (const event of watch(feed, ["AAPL", "MSFT"], {
  includeFundamentals: true,
})) {
  if (event.type === "earnings_released") {
    console.log(
      `${event.symbol} new earnings: EPS ${event.earnings.epsActual} ` +
      `(est. ${event.earnings.epsEstimate})`
    );
  }
}
```

## Options

```ts
interface WatchOptions {
  /** Exchange calendar for session detection. Default: "NYSE" */
  exchange?: ExchangeId;

  interval?: {
    /** Poll interval during regular hours (ms). Default: 5 000 */
    open?: number;
    /** Poll interval during pre/post market (ms). Default: 30 000 */
    prepost?: number;
    /** Check interval when market is closed (ms). Default: 60 000 */
    closed?: number;
  };

  /** Pause polling during closed sessions. Default: true */
  marketHoursAware?: boolean;

  /** % price spread that triggers a divergence event. Default: 0.5 */
  divergenceThreshold?: number;

  /** Consecutive errors before the generator throws. Default: 5 */
  maxErrors?: number;

  /** AbortSignal to stop the stream. */
  signal?: AbortSignal;

  /**
   * When true, monitors watched symbols for new quarterly earnings reports
   * and emits `earnings_released` events when a newer period is detected.
   * Default: false
   */
  includeFundamentals?: boolean;

  /**
   * How often to check for new earnings data, in milliseconds.
   * Only relevant when `includeFundamentals: true`.
   * Default: 900_000 (15 minutes)
   */
  fundamentalsIntervalMs?: number;
}
```

## Market-hours awareness

When `marketHoursAware: true` (default), the generator:

1. Checks the exchange session before each poll
2. During `"closed"` sessions, sleeps for `interval.closed` ms instead of fetching
3. Emits `market-open` / `market-close` events when the session changes

This eliminates wasted API calls overnight and on weekends:

```
00:00 — closed, checking every 60s
...
09:30 — market-open event emitted
09:30 — quote events every 5s
16:00 — market-close event emitted
16:00 — post-market events every 30s
20:00 — closed, checking every 60s
```

## Multi-provider divergence

When the `MarketFeed` has multiple providers, the stream fetches quotes from all of them each cycle. If prices diverge beyond `divergenceThreshold`, a `divergence` event is emitted alongside the quote events:

```ts
const feed = new MarketFeed({
  providers: [
    new YahooProvider(),
    new PolygonProvider({ apiKey: process.env.POLYGON_KEY! }),
  ],
});

for await (const event of watch(feed, ["AAPL"], { divergenceThreshold: 1.0 })) {
  if (event.type === "divergence") {
    console.log(`Provider spread: ${event.spreadPct.toFixed(2)}%`);
  }
}
```

## Stopping the stream

Always pass an `AbortSignal` so the stream can be cleanly cancelled:

```ts
const controller = new AbortController();

// Stop after 30 seconds
setTimeout(() => controller.abort(), 30_000);

for await (const event of watch(feed, ["AAPL"], { signal: controller.signal })) {
  // ...
}
// generator returns cleanly after abort
```

## vs. `market-feed/ws`

| | `market-feed/stream` | `market-feed/ws` |
|---|---|---|
| Transport | HTTP polling | WebSocket |
| Latency | Seconds (configurable interval) | Sub-second (tick-by-tick) |
| Providers | All (Yahoo, AV, Polygon, etc.) | Polygon + Finnhub only |
| Data granularity | Quote snapshots | Individual trade executions |
| Market-hours aware | Yes (built-in) | No |
| Session events | Yes | No |
