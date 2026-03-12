# Stock Screener

`market-feed/screener` filters a list of symbols against a set of criteria using live quote data. All criteria are evaluated with **AND logic** — a symbol must pass every criterion to be included.

## Basic usage

```ts
import { screen } from "market-feed/screener";
import { MarketFeed } from "market-feed";

const feed = new MarketFeed();

// Find large-caps that gained > 1.5% today on above-average volume
const results = await screen(feed, ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA", "META"], {
  criteria: [
    { type: "market_cap_above", value: 100_000_000_000 },  // > $100B market cap
    { type: "change_pct_above", value: 1.5 },               // up > 1.5% today
    { type: "volume_above",     value: 10_000_000 },        // > 10M shares traded
  ],
  limit: 5,
});

for (const r of results) {
  console.log(`${r.symbol}: $${r.quote.price.toFixed(2)} (+${r.quote.changePercent.toFixed(2)}%)`);
}
```

## Criterion types

| Type | Passes when |
|------|-------------|
| `price_above` | `quote.price > value` |
| `price_below` | `quote.price < value` |
| `change_pct_above` | `quote.changePercent > value` |
| `change_pct_below` | `quote.changePercent < value` (use negative values for down days) |
| `volume_above` | `quote.volume > value` |
| `volume_below` | `quote.volume < value` |
| `volume_vs_avg_above` | `quote.volume > quote.avgVolume * value` — e.g. `value: 2` means 2× average volume (pass-through if avgVolume undefined) |
| `volume_vs_avg_below` | `quote.volume < quote.avgVolume * value` (pass-through if avgVolume undefined) |
| `market_cap_above` | `quote.marketCap > value` (excluded if marketCap is undefined) |
| `market_cap_below` | `quote.marketCap < value` (excluded if marketCap is undefined) |
| `52w_high_pct_below` | Price is within N% of the 52-week high |
| `52w_low_pct_above` | Price is at least N% above the 52-week low |
| `custom` | `{ type: "custom", fn: (quote: Quote) => boolean }` |

## Custom predicate

```ts
const results = await screen(feed, symbols, {
  criteria: [
    // P/E proxy: price-to-earnings approximation using market cap and revenue
    {
      type: "custom",
      fn: (q) => q.price > 50 && (q.volume ?? 0) > q.avgVolume! * 1.5, // volume surge
    },
  ],
});
```

## 52-week range criteria

```ts
// Stocks within 5% of their 52-week high (near breakout territory)
{ type: "52w_high_pct_below", value: 5 }

// Stocks that have recovered at least 20% from their 52-week low
{ type: "52w_low_pct_above", value: 20 }
```

::: info
If `quote.fiftyTwoWeekHigh` or `quote.fiftyTwoWeekLow` is `undefined`, the criterion passes automatically (does not filter).
:::

## Batching large symbol lists

For large universes, batch the `quote()` calls to avoid rate limits:

```ts
const sp500 = ["AAPL", "MSFT", /* ...498 more */];

const results = await screen(feed, sp500, {
  criteria: [
    { type: "change_pct_above", value: 3 },
    { type: "volume_above", value: 5_000_000 },
  ],
  batchSize: 50,   // fetch 50 symbols per quote() call
  limit: 20,       // stop after 20 matches
});
```

## Options

```ts
interface ScreenerOptions {
  /** Array of criteria — ALL must pass (AND logic). */
  criteria: ScreenerCriterion[];

  /**
   * Max symbols per quote() call.
   * Useful for providers with per-request symbol limits.
   * Default: all symbols in one call.
   */
  batchSize?: number;

  /**
   * Max results to return.
   * Stops processing as soon as this count is reached.
   * Default: all matching symbols.
   */
  limit?: number;
}
```

## Result shape

```ts
interface ScreenerResult {
  symbol: string;
  quote: Quote;
  matchedCriteria: number;  // always equals criteria.length
}
```

## Duck-typed source

`screen()` accepts any object with a `quote(symbols[]) → Quote[]` method. This means it works with `MarketFeed`, any individual provider, or a test mock:

```ts
import { PolygonProvider } from "market-feed";

const polygon = new PolygonProvider({ apiKey: process.env.POLYGON_KEY! });

// Use a single provider directly (no fallback, no cache)
const results = await screen(polygon, symbols, { criteria });
```

## Common patterns

### Momentum scan — top movers

```ts
const results = await screen(feed, universe, {
  criteria: [
    { type: "change_pct_above", value: 5 },
    { type: "volume_above",     value: 1_000_000 },
  ],
  limit: 10,
});
```

### Near 52-week high with volume confirmation

```ts
const results = await screen(feed, universe, {
  criteria: [
    { type: "52w_high_pct_below", value: 3 },    // within 3% of yearly high
    { type: "volume_above",       value: 500_000 },
    { type: "price_above",        value: 10 },    // exclude micro-caps / penny stocks
  ],
});
```

### Oversold large-caps

```ts
const results = await screen(feed, universe, {
  criteria: [
    { type: "change_pct_below",  value: -5 },
    { type: "market_cap_above",  value: 10_000_000_000 }, // > $10B
  ],
});
```

### Volume surge — relative to average

```ts
// Stocks trading at 3× or more their 30-day average volume
const results = await screen(feed, universe, {
  criteria: [
    { type: "volume_vs_avg_above", value: 3 },
    { type: "price_above",         value: 5 }, // exclude penny stocks
  ],
});
```
