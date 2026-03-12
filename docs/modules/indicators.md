# Technical Indicators

`market-feed/indicators` provides eight technical indicators as pure functions over `HistoricalBar[]`. No network, no async, fully tree-shakeable.

## Function reference

| Function | Returns | Default params |
|----------|---------|----------------|
| `sma(bars, period)` | `IndicatorPoint[]` | — |
| `ema(bars, period)` | `IndicatorPoint[]` | — |
| `rsi(bars, period?)` | `IndicatorPoint[]` | `period: 14` |
| `macd(bars, fast?, slow?, signal?)` | `MACDPoint[]` | `12, 26, 9` |
| `bollingerBands(bars, period?, stdDevMult?)` | `BollingerPoint[]` | `20, 2` |
| `atr(bars, period?)` | `IndicatorPoint[]` | `period: 14` |
| `vwap(bars)` | `IndicatorPoint[]` | — |
| `stochastic(bars, kPeriod?, dPeriod?)` | `StochasticPoint[]` | `14, 3` |

All functions return an empty array (not an error) when there is insufficient data.

## Setup

```ts
import { MarketFeed } from "market-feed";
import { sma, ema, rsi, macd, bollingerBands, atr, vwap, stochastic } from "market-feed/indicators";

const feed = new MarketFeed();
const bars = await feed.historical("AAPL", { period1: "2024-01-01", interval: "1d" });
```

## Moving averages

```ts
const sma20 = sma(bars, 20);
// [{ date: Date, value: 189.5 }, ...]

const ema12 = ema(bars, 12);
```

Output type:

```ts
interface IndicatorPoint {
  date: Date;
  value: number;
}
```

## RSI

```ts
const rsi14 = rsi(bars, 14); // values in [0, 100]

const overbought = rsi14.filter(p => p.value > 70);
const oversold   = rsi14.filter(p => p.value < 30);
```

## MACD

```ts
const macdResult = macd(bars, 12, 26, 9);
```

```ts
interface MACDPoint {
  date: Date;
  macd: number;       // fast EMA − slow EMA
  signal: number;     // EMA of macd line
  histogram: number;  // macd − signal
}
```

## Bollinger Bands

```ts
const bb = bollingerBands(bars, 20, 2);
```

```ts
interface BollingerPoint {
  date: Date;
  upper: number;   // middle + 2σ
  middle: number;  // 20-period SMA
  lower: number;   // middle − 2σ
}
```

## ATR — Average True Range

```ts
const atr14 = atr(bars, 14);
// IndicatorPoint[] — higher values = higher volatility
```

## VWAP

Cumulative VWAP from the first bar in the series:

```ts
const vwapPoints = vwap(bars);
// IndicatorPoint[] — running volume-weighted average price
```

## Stochastic Oscillator

```ts
const stoch = stochastic(bars, 14, 3);
```

```ts
interface StochasticPoint {
  date: Date;
  k: number;  // %K — raw stochastic [0, 100]
  d: number;  // %D — 3-period SMA of %K
}
```

## Example: MACD crossover signal

```ts
const macdData = macd(bars);

for (let i = 1; i < macdData.length; i++) {
  const prev = macdData[i - 1]!;
  const curr = macdData[i]!;

  // Bullish crossover: MACD crosses above signal
  if (prev.macd < prev.signal && curr.macd > curr.signal) {
    console.log(`Bullish MACD crossover on ${curr.date.toDateString()}`);
  }

  // Bearish crossover: MACD crosses below signal
  if (prev.macd > prev.signal && curr.macd < curr.signal) {
    console.log(`Bearish MACD crossover on ${curr.date.toDateString()}`);
  }
}
```

## Example: Bollinger Band squeeze

```ts
const bb = bollingerBands(bars, 20, 2);

for (const point of bb) {
  const bandWidth = (point.upper - point.lower) / point.middle;
  if (bandWidth < 0.05) {
    console.log(`Bollinger squeeze on ${point.date.toDateString()} — width: ${(bandWidth * 100).toFixed(2)}%`);
  }
}
```
