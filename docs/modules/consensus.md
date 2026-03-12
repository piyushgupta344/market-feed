# Price Consensus

`market-feed/consensus` queries all configured providers simultaneously and returns a statistically weighted price consensus. Unlike `feed.quote()` — which stops at the first successful provider — `consensus()` fires every provider in parallel and combines their results.

## Basic usage

```ts
import { consensus } from "market-feed/consensus";
import { MarketFeed, YahooProvider, AlphaVantageProvider, PolygonProvider } from "market-feed";

const feed = new MarketFeed({
  providers: [
    new YahooProvider(),
    new AlphaVantageProvider({ apiKey: process.env.AV_KEY! }),
    new PolygonProvider({ apiKey: process.env.POLYGON_KEY! }),
  ],
});

const result = await consensus(feed.providers, "AAPL");

console.log(result.price);       // 189.82 — weighted mean
console.log(result.confidence);  // 0.97   — 0 = no agreement, 1 = perfect
console.log(result.spreadPct);   // 0.042  — spread as % of price
console.log(result.flags);       // [] or ["HIGH_DIVERGENCE", ...]
```

## Result shape

```ts
interface ConsensusResult {
  symbol: string;
  price: number;
  confidence: number;    // 0–1
  spread: number;        // absolute max–min
  spreadPct: number;     // spread / price × 100
  flags: ConsensusFlag[];
  providers: Record<string, {
    price: number;
    weight: number;
    stale: boolean;
    included: boolean;
  }>;
  timestamp: Date;
}
```

## Provider detail

```ts
console.log(result.providers);
// {
//   yahoo:           { price: 189.84, weight: 0.33, stale: false, included: true },
//   polygon:         { price: 189.80, weight: 0.33, stale: false, included: true },
//   "alpha-vantage": { price: 189.82, weight: 0.33, stale: false, included: true },
// }
```

## Flags

| Flag | Meaning |
|------|---------|
| `HIGH_DIVERGENCE` | `spreadPct` > `divergenceThreshold` |
| `STALE_DATA` | At least one provider returned a quote older than `stalenessThreshold` |
| `SINGLE_SOURCE` | Only one provider responded |
| `OUTLIER_EXCLUDED` | At least one provider was excluded as a price outlier |

## Options

```ts
interface ConsensusOptions {
  /**
   * Seconds before a quote is considered stale.
   * Stale providers receive half weight. Default: 60
   */
  stalenessThreshold?: number;

  /**
   * % deviation from the median that marks a provider as an outlier.
   * Outliers are excluded from the weighted mean. Default: 2.0
   */
  divergenceThreshold?: number;

  /**
   * Custom per-provider weights. Values are normalised automatically.
   * Default: equal weights.
   * @example { "polygon": 2, "yahoo": 1 }
   */
  weights?: Record<string, number>;
}
```

## Outlier detection

Outlier detection uses the **median** (not the mean) as the reference point, which prevents all providers from being marked as outliers in a high-divergence scenario:

1. Compute the per-provider median price
2. Any provider whose price deviates > `divergenceThreshold`% from the median is flagged and excluded
3. The weighted mean is computed over the remaining (included) providers

## Confidence score

Confidence is `1 − spreadPct / divergenceThreshold`, clamped to `[0, 1]`. A spread of zero gives confidence = 1. A spread equal to the divergence threshold gives confidence = 0.
