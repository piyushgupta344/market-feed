# Portfolio

`market-feed/portfolio` tracks a collection of positions and computes live P&L by fetching current prices on demand.

## Setup

```ts
import { Portfolio } from "market-feed/portfolio";
import { MarketFeed } from "market-feed";

const feed = new MarketFeed();

const portfolio = new Portfolio([
  { symbol: "AAPL", quantity: 10, avgCost: 150.00 },
  { symbol: "MSFT", quantity:  5, avgCost: 280.00 },
  { symbol: "TSLA", quantity: -3, avgCost: 250.00 }, // short position
]);
```

## Live snapshot

```ts
const snap = await portfolio.snapshot(feed);

console.log(`Total value:      $${snap.totalMarketValue.toFixed(2)}`);
console.log(`Unrealised P&L:   $${snap.totalUnrealizedPnl.toFixed(2)}`);
console.log(`Today's change:   $${snap.totalDayChange.toFixed(2)}`);
console.log(`Cost basis:       $${snap.totalCostBasis.toFixed(2)}`);

for (const pos of snap.positions) {
  const pct = (pos.unrealizedPnlPct * 100).toFixed(2);
  console.log(`${pos.symbol}: $${pos.marketValue.toFixed(2)} (${pct}%)`);
}
```

## Snapshot shape

```ts
interface PortfolioSnapshot {
  positions: PositionSnapshot[];
  totalMarketValue: number;
  totalCostBasis: number;
  totalUnrealizedPnl: number;
  totalUnrealizedPnlPct: number;
  totalDayChange: number;
  timestamp: Date;
}

interface PositionSnapshot {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  dayChange: number;
  dayChangePct: number;
  quote: Quote;
}
```

## Position fields

| Field | Type | Description |
|-------|------|-------------|
| `symbol` | `string` | Ticker symbol |
| `quantity` | `number` | Units held. Negative = short position. |
| `avgCost` | `number` | Average cost per unit |
| `currency` | `string?` | Defaults to `"USD"` |
| `openedAt` | `Date?` | When the position was opened |
| `notes` | `string?` | Free-form notes |

## Managing positions

```ts
// Add or replace a position (chainable)
portfolio
  .add({ symbol: "NVDA", quantity: 2, avgCost: 800 })
  .add({ symbol: "AMZN", quantity: 1, avgCost: 180 });

// Remove a position
portfolio.remove("TSLA");

// Read
portfolio.get("AAPL");    // Position | undefined
portfolio.list();         // readonly Position[]
portfolio.size;           // number
```

## Short positions

Short positions use negative `quantity`. P&L is computed correctly:

```ts
// Short 3 shares at $250 average
const short = { symbol: "TSLA", quantity: -3, avgCost: 250.00 };

// If price drops to $200:
// unrealizedPnl = (250 - 200) × 3 = +$150 ✓
```

## Multi-currency portfolios

Each position can specify its own `currency`. The snapshot reports values in each position's native currency — currency conversion is not performed automatically.
