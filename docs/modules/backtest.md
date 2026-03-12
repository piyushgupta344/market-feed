# Backtesting

`market-feed/backtest` is a pure-function backtesting engine. Pass historical bars and signal functions — get back a full performance report.

## Basic usage

```ts
import { backtest } from "market-feed/backtest";
import type { EntrySignal, ExitSignal } from "market-feed/backtest";
import { MarketFeed } from "market-feed";

const feed = new MarketFeed();
const bars = await feed.historical("AAPL", {
  period1: "2020-01-01",
  period2: "2024-12-31",
  interval: "1d",
});

// Buy when today's close > yesterday's close (momentum)
const entry: EntrySignal = (bars, i) =>
  i > 0 && bars[i]!.close > bars[i - 1]!.close;

// Sell when today's close < yesterday's close
const exit: ExitSignal = (bars, i) =>
  i > 0 && bars[i]!.close < bars[i - 1]!.close;

const result = backtest("AAPL", bars, entry, exit, {
  initialCapital: 10_000,
  quantity: 10,
  commission: 1,
});

console.log(`Total return:    ${(result.totalReturn * 100).toFixed(2)}%`);
console.log(`CAGR:            ${(result.annualizedReturn * 100).toFixed(2)}%`);
console.log(`Sharpe ratio:    ${result.sharpeRatio.toFixed(2)}`);
console.log(`Max drawdown:    ${(result.maxDrawdown * 100).toFixed(2)}%`);
console.log(`Win rate:        ${(result.winRate * 100).toFixed(1)}%`);
console.log(`Profit factor:   ${result.profitFactor.toFixed(2)}`);
console.log(`Total trades:    ${result.totalTrades}`);
```

## Signal functions

```ts
type EntrySignal = (bars: HistoricalBar[], index: number) => boolean;
type ExitSignal  = (bars: HistoricalBar[], index: number, entryPrice: number) => boolean;
```

- `bars[index]` is the current bar
- Signals fire at `bars[i].close` — the entry/exit price is the closing price
- At most one position is held at a time
- Any open position at the final bar is closed at the last close

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `initialCapital` | `number` | `100_000` | Starting portfolio value |
| `quantity` | `number` | `1` | Shares per trade |
| `commission` | `number` | `0` | One-way commission per trade |

## Result

```ts
interface BacktestResult {
  totalReturn: number;        // fraction — 0.25 = 25%
  annualizedReturn: number;   // CAGR
  sharpeRatio: number;        // annualised (risk-free rate = 0)
  maxDrawdown: number;        // positive fraction — peak-to-trough
  winRate: number;            // fraction of profitable trades
  profitFactor: number;       // gross profit / gross loss (Infinity = no losses)
  totalTrades: number;        // completed round-trip trades
  trades: BacktestTrade[];    // full trade ledger
  finalCapital: number;
  peakCapital: number;
}
```

## Trade ledger

```ts
interface BacktestTrade {
  entryDate: Date;
  exitDate: Date;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;            // net of commission
  pnlPct: number;
  commission: number;
}
```

## Example: RSI mean-reversion strategy

```ts
import { rsi } from "market-feed/indicators";
import { backtest } from "market-feed/backtest";

const rsiValues = rsi(bars, 14);
const rsiMap = new Map(rsiValues.map(p => [p.date.getTime(), p.value]));

const entry: EntrySignal = (bars, i) => {
  const rsiVal = rsiMap.get(bars[i]!.date.getTime());
  return rsiVal !== undefined && rsiVal < 30; // oversold
};

const exit: ExitSignal = (bars, i) => {
  const rsiVal = rsiMap.get(bars[i]!.date.getTime());
  return rsiVal !== undefined && rsiVal > 70; // overbought
};

const result = backtest("AAPL", bars, entry, exit);
```

## Portfolio backtesting

`portfolioBacktest()` runs multiple assets simultaneously over a shared cash pool.

```ts
import { portfolioBacktest } from "market-feed/backtest";
import { MarketFeed } from "market-feed";

const feed = new MarketFeed();
const [aaplBars, msftBars, spyBars] = await Promise.all([
  feed.historical("AAPL", { period1: "2022-01-01", interval: "1d" }),
  feed.historical("MSFT", { period1: "2022-01-01", interval: "1d" }),
  feed.historical("SPY",  { period1: "2022-01-01", interval: "1d" }),
]);

// Same momentum strategy on both symbols
const entry: EntrySignal = (bars, i) => i > 0 && bars[i]!.close > bars[i - 1]!.close;
const exit: ExitSignal  = (bars, i) => i > 0 && bars[i]!.close < bars[i - 1]!.close;

const result = portfolioBacktest(
  [
    { symbol: "AAPL", bars: aaplBars, entry, exit },
    { symbol: "MSFT", bars: msftBars, entry, exit },
  ],
  {
    initialCapital: 100_000,
    commission: 1,
    // Allocate 10% of current equity to each new position
    sizing: { type: "percent_equity", pct: 10 },
    // Compare against SPY buy-and-hold
    benchmarkBars: spyBars,
    benchmarkSymbol: "SPY",
  },
);

console.log(`Portfolio return:   ${(result.totalReturn * 100).toFixed(2)}%`);
console.log(`CAGR:               ${(result.annualizedReturn * 100).toFixed(2)}%`);
console.log(`Sharpe:             ${result.sharpeRatio.toFixed(2)}`);
console.log(`Max drawdown:       ${(result.maxDrawdown * 100).toFixed(2)}%`);
console.log(`Benchmark (SPY):    ${(result.benchmarkReturn! * 100).toFixed(2)}%`);

// Per-asset breakdown
for (const [symbol, summary] of Object.entries(result.byAsset)) {
  console.log(`${symbol}: ${summary.totalTrades} trades, win rate ${(summary.winRate * 100).toFixed(1)}%`);
}
```

### Position sizing

| `type` | Description |
|--------|-------------|
| `fixed_quantity` | Always trade N shares (default: 1) |
| `fixed_dollar` | Buy floor(amount / price) shares at each entry |
| `percent_equity` | Buy floor((equity × pct/100) / price) shares at each entry |

Per-asset sizing can be set via the `sizing` field on each `PortfolioAsset` — it overrides the global option for that asset.

### `PortfolioBacktestResult`

| Field | Description |
|-------|-------------|
| `totalReturn` | Combined portfolio return as a fraction |
| `annualizedReturn` | CAGR of the combined equity curve |
| `sharpeRatio` | Annualised Sharpe (risk-free = 0) |
| `maxDrawdown` | Max peak-to-trough of combined equity curve |
| `winRate` | Combined win rate across all assets |
| `profitFactor` | Combined gross profit / gross loss |
| `totalTrades` | Total round-trip trades across all assets |
| `equityCurve` | `{ date, equity }[]` — combined portfolio equity |
| `byAsset` | `Record<symbol, PortfolioAssetSummary>` — per-asset stats |
| `benchmarkReturn` | Buy-and-hold return (when `benchmarkBars` provided) |
| `benchmarkAnnualizedReturn` | Buy-and-hold CAGR |

## Limitations

- No slippage model (fills at closing price)
- Risk-free rate for Sharpe is assumed to be 0
- Multi-asset engine does not model correlation for position sizing (positions are independent)
