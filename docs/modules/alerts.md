# Price Alerts

`market-feed/alerts` polls a quote feed and yields `AlertEvent` objects whenever configured conditions are met.

## Basic usage

```ts
import { watchAlerts } from "market-feed/alerts";
import type { AlertConfig } from "market-feed/alerts";
import { MarketFeed } from "market-feed";

const feed = new MarketFeed();
const controller = new AbortController();

const alerts: AlertConfig[] = [
  // Fire once when AAPL crosses $200
  { symbol: "AAPL", condition: { type: "price_above", threshold: 200 }, once: true },

  // Alert on TSLA intraday crash; debounce 5 min to avoid repeat fires
  { symbol: "TSLA", condition: { type: "change_pct_below", threshold: -5 }, debounceMs: 300_000 },

  // Unusual volume spike
  { symbol: "MSFT", condition: { type: "volume_above", threshold: 100_000_000 } },
];

for await (const event of watchAlerts(feed, alerts, {
  intervalMs: 5_000,
  signal: controller.signal,
})) {
  console.log(
    `[${event.triggeredAt.toISOString()}] ` +
    `${event.alert.symbol} triggered: $${event.quote.price}`,
  );
}
```

## Alert conditions

| `type` | Fires when |
|--------|-----------|
| `price_above` | `quote.price > threshold` |
| `price_below` | `quote.price < threshold` |
| `change_pct_above` | `quote.changePercent > threshold` |
| `change_pct_below` | `quote.changePercent < threshold` |
| `volume_above` | `quote.volume > threshold` |

## `AlertConfig`

```ts
interface AlertConfig {
  /** Ticker to watch */
  symbol: string;

  /** Trigger condition */
  condition: AlertCondition;

  /**
   * Remove this alert after it fires once.
   * Default: false (permanent alert)
   */
  once?: boolean;

  /**
   * Suppress re-fires within this window (ms).
   * Default: 0 (no debounce)
   */
  debounceMs?: number;
}
```

## `AlertEvent`

```ts
interface AlertEvent {
  type: "triggered";
  alert: AlertConfig;
  quote: Quote;
  triggeredAt: Date;
}
```

## `AlertsOptions`

```ts
interface AlertsOptions {
  /** Poll interval in milliseconds. Default: 5 000 */
  intervalMs?: number;
  /** AbortSignal to stop the generator. */
  signal?: AbortSignal;
}
```

## Generator lifecycle

- When all `once` alerts have fired, the generator **terminates automatically** — no need to abort
- Permanent alerts (`once: false`) run until `signal.abort()` is called
- Transient fetch errors are silently swallowed and retried on the next interval
- The generator fetches quotes for all alert symbols in a single `feed.quote()` call per interval

## Combining with `once` and permanent alerts

```ts
const alerts: AlertConfig[] = [
  // Fires exactly once, then removes itself
  { symbol: "NVDA", condition: { type: "price_above", threshold: 1000 }, once: true },

  // Fires every time (with 10-min debounce to reduce noise)
  { symbol: "NVDA", condition: { type: "change_pct_below", threshold: -3 }, debounceMs: 600_000 },
];

// Generator terminates when the once alert fires (if the permanent alert
// never fires, use signal.abort() to stop it externally)
for await (const event of watchAlerts(feed, alerts, { signal: controller.signal })) {
  console.log(event.alert.symbol, event.alert.condition.type);
}
```
