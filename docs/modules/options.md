# Options Chain

`market-feed/options` fetches options chains for equities. Currently implemented by **Polygon.io** (free tier supports delayed data).

## Basic usage

```ts
import { getOptionChain } from "market-feed/options";
import { PolygonProvider } from "market-feed";

const polygon = new PolygonProvider({ apiKey: process.env.POLYGON_KEY! });

const chain = await getOptionChain(polygon, "AAPL", {
  expiry: "2024-07-19",
});

console.log(`Calls: ${chain.calls.length}, Puts: ${chain.puts.length}`);

for (const contract of chain.calls) {
  console.log(
    `Strike $${contract.strike}  ` +
    `IV ${(contract.impliedVolatility! * 100).toFixed(1)}%  ` +
    `Δ ${contract.delta?.toFixed(3)}`,
  );
}
```

## Filtering the chain

```ts
// Calls only, within a strike range
const chain = await getOptionChain(polygon, "AAPL", {
  expiry:     "2024-07-19",
  type:       "call",
  strikeLow:  170,
  strikeHigh: 210,
  limit:      20,
});

// All expirations for a specific strike
const atStrike = await getOptionChain(polygon, "TSLA", {
  strike: 200,
});
```

## `OptionChainOptions`

```ts
interface OptionChainOptions {
  /** Filter to a specific expiry date, e.g. "2024-07-19" */
  expiry?: string;
  /** Exact strike price filter */
  strike?: number;
  /** Minimum strike price */
  strikeLow?: number;
  /** Maximum strike price */
  strikeHigh?: number;
  /** Return only "call" or "put" contracts. Default: both */
  type?: "call" | "put";
  /** Max contracts to return. Default: 50 */
  limit?: number;
  /** Include raw Polygon API response on each contract */
  raw?: boolean;
}
```

## `OptionChain`

```ts
interface OptionChain {
  underlyingSymbol: string;
  calls: OptionContract[];
  puts: OptionContract[];
  fetchedAt: Date;
}
```

## `OptionContract`

```ts
interface OptionContract {
  /** OCC option ticker, e.g. "O:AAPL240719C00150000" */
  ticker: string;
  underlyingSymbol: string;
  type: "call" | "put";
  strike: number;
  expiry: Date;
  style: "american" | "european";
  sharesPerContract: number;

  // Market data
  bid?: number;
  ask?: number;
  /** Mid-point of bid/ask */
  midpoint?: number;
  lastPrice?: number;
  volume?: number;
  openInterest?: number;
  impliedVolatility?: number;

  // Greeks
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;

  // Day OHLCV
  open?: number;
  high?: number;
  low?: number;
  close?: number;

  provider: string;
  raw?: unknown;
}
```

## Using `MarketFeed`

If you configure `MarketFeed` with a `PolygonProvider`, `optionChain()` is available directly on the feed with automatic caching (60s TTL):

```ts
import { MarketFeed, PolygonProvider } from "market-feed";

const feed = new MarketFeed({
  providers: [new PolygonProvider({ apiKey: process.env.POLYGON_KEY! })],
});

const chain = await feed.optionChain("AAPL", { expiry: "2024-07-19" });
```

## Common patterns

### Scan for high-IV calls

```ts
const chain = await getOptionChain(polygon, "AAPL", { type: "call" });

const highIv = chain.calls.filter(
  (c) => (c.impliedVolatility ?? 0) > 0.6 && (c.openInterest ?? 0) > 100,
);
```

### Near-the-money contracts

```ts
const quote = await polygon.quote(["AAPL"]);
const spot = quote[0]!.price;

const chain = await getOptionChain(polygon, "AAPL", {
  strikeLow:  spot * 0.95,
  strikeHigh: spot * 1.05,
});
```

### Delta-neutral scan

```ts
const chain = await getOptionChain(polygon, "SPY", { type: "call" });

// Contracts with delta between 0.40 and 0.60 (near 50-delta)
const atm = chain.calls.filter(
  (c) => c.delta !== undefined && c.delta >= 0.4 && c.delta <= 0.6,
);
```

## Provider support

| Provider | Options chain |
|----------|:---:|
| Yahoo Finance | — |
| Alpha Vantage | — |
| Polygon.io | ✓ |
| Finnhub | — |
| Twelve Data | — |
| Tiingo | — |

::: info
Polygon free tier provides 15-minute delayed options data. A paid plan unlocks real-time quotes.
:::
