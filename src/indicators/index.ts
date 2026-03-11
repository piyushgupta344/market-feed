import type { HistoricalBar } from "../types/historical.js";
import type { BollingerPoint, IndicatorPoint, MACDPoint, StochasticPoint } from "./types.js";

export type { BollingerPoint, IndicatorPoint, MACDPoint, StochasticPoint } from "./types.js";

// ---------------------------------------------------------------------------
// Simple Moving Average (SMA)
// ---------------------------------------------------------------------------

/**
 * Simple Moving Average.
 *
 * Returns one point per bar starting at bar index `period − 1`.
 * Uses an O(1) sliding window.
 */
export function sma(bars: HistoricalBar[], period: number): IndicatorPoint[] {
  if (bars.length < period || period < 1) return [];
  const result: IndicatorPoint[] = [];
  let sum = 0;

  for (let i = 0; i < bars.length; i++) {
    sum += bars[i]!.close;
    if (i >= period) sum -= bars[i - period]!.close;
    if (i >= period - 1) {
      result.push({ date: bars[i]!.date, value: sum / period });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Exponential Moving Average (EMA)
// ---------------------------------------------------------------------------

/**
 * Exponential Moving Average using multiplier k = 2 / (period + 1).
 *
 * The first value is seeded with the SMA of the opening `period` bars.
 * Returns one point per bar starting at bar index `period − 1`.
 */
export function ema(bars: HistoricalBar[], period: number): IndicatorPoint[] {
  if (bars.length < period || period < 1) return [];
  const closes = bars.map((b) => b.close);
  const values = emaFromValues(closes, period);
  return values.map((v, i) => ({ date: bars[period - 1 + i]!.date, value: v }));
}

// ---------------------------------------------------------------------------
// RSI (Relative Strength Index)
// ---------------------------------------------------------------------------

/**
 * Relative Strength Index using Wilder's smoothing method.
 *
 * Default period is 14. Returns one point per bar starting at bar index `period`.
 */
export function rsi(bars: HistoricalBar[], period = 14): IndicatorPoint[] {
  if (bars.length <= period || period < 1) return [];
  const result: IndicatorPoint[] = [];

  // Seed: average gain/loss over the first `period` deltas (bars[1..period])
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const delta = bars[i]!.close - bars[i - 1]!.close;
    if (delta > 0) avgGain += delta;
    else avgLoss -= delta;
  }
  avgGain /= period;
  avgLoss /= period;

  const firstRsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  result.push({ date: bars[period]!.date, value: firstRsi });

  // Wilder smoothing for subsequent bars
  for (let i = period + 1; i < bars.length; i++) {
    const delta = bars[i]!.close - bars[i - 1]!.close;
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? -delta : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rsiValue = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    result.push({ date: bars[i]!.date, value: rsiValue });
  }

  return result;
}

// ---------------------------------------------------------------------------
// MACD
// ---------------------------------------------------------------------------

/**
 * Moving Average Convergence/Divergence.
 *
 * @param fast    Fast EMA period (default 12)
 * @param slow    Slow EMA period (default 26)
 * @param signal  Signal line EMA period (default 9)
 *
 * Requires at least `slow + signal − 1` bars to produce any output.
 */
export function macd(bars: HistoricalBar[], fast = 12, slow = 26, signal = 9): MACDPoint[] {
  if (bars.length < slow + signal - 1 || fast >= slow || fast < 1) return [];

  const closes = bars.map((b) => b.close);
  const fastVals = emaFromValues(closes, fast);  // length = n - fast + 1
  const slowVals = emaFromValues(closes, slow);  // length = n - slow + 1

  // Align fast to slow: fastVals[slow - fast + j] ↔ slowVals[j]
  const offset = slow - fast;
  const macdLine: number[] = slowVals.map((sv, j) => fastVals[j + offset]! - sv);

  // Signal = EMA of macd line
  const signalVals = emaFromValues(macdLine, signal);

  // Output starts at bar index: (slow - 1) + (signal - 1) = slow + signal - 2
  const startBarIdx = slow + signal - 2;

  return signalVals.map((sig, i) => {
    const m = macdLine[signal - 1 + i]!;
    return {
      date: bars[startBarIdx + i]!.date,
      macd: m,
      signal: sig,
      histogram: m - sig,
    };
  });
}

// ---------------------------------------------------------------------------
// Bollinger Bands
// ---------------------------------------------------------------------------

/**
 * Bollinger Bands.
 *
 * @param period      SMA period (default 20)
 * @param stdDevMult  Standard deviation multiplier for band width (default 2)
 */
export function bollingerBands(
  bars: HistoricalBar[],
  period = 20,
  stdDevMult = 2,
): BollingerPoint[] {
  if (bars.length < period || period < 1) return [];
  const result: BollingerPoint[] = [];

  for (let i = period - 1; i < bars.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += bars[j]!.close;
    const middle = sum / period;

    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = bars[j]!.close - middle;
      variance += diff * diff;
    }
    const stdDev = Math.sqrt(variance / period);

    result.push({
      date: bars[i]!.date,
      upper: middle + stdDevMult * stdDev,
      middle,
      lower: middle - stdDevMult * stdDev,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// ATR (Average True Range)
// ---------------------------------------------------------------------------

/**
 * Average True Range using Wilder's smoothing method.
 *
 * Default period is 14. Returns one point per bar starting at bar index `period`.
 * Requires at least `period + 1` bars.
 */
export function atr(bars: HistoricalBar[], period = 14): IndicatorPoint[] {
  if (bars.length <= period || period < 1) return [];
  const result: IndicatorPoint[] = [];

  // True ranges start at bar[1] (needs previous close)
  const trueRanges: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const curr = bars[i]!;
    const prev = bars[i - 1]!;
    trueRanges.push(
      Math.max(
        curr.high - curr.low,
        Math.abs(curr.high - prev.close),
        Math.abs(curr.low - prev.close),
      ),
    );
  }

  // Seed: average of first `period` true ranges → value at bars[period]
  let atrVal = 0;
  for (let i = 0; i < period; i++) atrVal += trueRanges[i]!;
  atrVal /= period;
  result.push({ date: bars[period]!.date, value: atrVal });

  // Wilder smoothing
  for (let i = period; i < trueRanges.length; i++) {
    atrVal = (atrVal * (period - 1) + trueRanges[i]!) / period;
    result.push({ date: bars[i + 1]!.date, value: atrVal });
  }

  return result;
}

// ---------------------------------------------------------------------------
// VWAP (Volume-Weighted Average Price)
// ---------------------------------------------------------------------------

/**
 * Volume-Weighted Average Price — cumulative from the first bar.
 *
 * Returns one point per bar (same length as input).
 * Most meaningful for intraday data but works on any OHLCV series.
 */
export function vwap(bars: HistoricalBar[]): IndicatorPoint[] {
  if (bars.length === 0) return [];

  let cumTPV = 0; // cumulative typical-price × volume
  let cumVol = 0;

  return bars.map((bar) => {
    const typicalPrice = (bar.high + bar.low + bar.close) / 3;
    cumTPV += typicalPrice * bar.volume;
    cumVol += bar.volume;
    return { date: bar.date, value: cumVol === 0 ? 0 : cumTPV / cumVol };
  });
}

// ---------------------------------------------------------------------------
// Stochastic Oscillator
// ---------------------------------------------------------------------------

/**
 * Stochastic Oscillator (%K and %D).
 *
 * @param kPeriod  %K lookback window (default 14)
 * @param dPeriod  %D smoothing period / SMA of %K (default 3)
 *
 * Requires at least `kPeriod + dPeriod − 1` bars to produce any output.
 */
export function stochastic(
  bars: HistoricalBar[],
  kPeriod = 14,
  dPeriod = 3,
): StochasticPoint[] {
  if (bars.length < kPeriod + dPeriod - 1 || kPeriod < 1) return [];

  // Compute raw %K values
  const kValues: { date: Date; k: number }[] = [];
  for (let i = kPeriod - 1; i < bars.length; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      hh = Math.max(hh, bars[j]!.high);
      ll = Math.min(ll, bars[j]!.low);
    }
    const range = hh - ll;
    // When all prices are identical, treat as neutral (50)
    const k = range === 0 ? 50 : (100 * (bars[i]!.close - ll)) / range;
    kValues.push({ date: bars[i]!.date, k });
  }

  // %D = SMA of %K over dPeriod
  const result: StochasticPoint[] = [];
  for (let i = dPeriod - 1; i < kValues.length; i++) {
    let sum = 0;
    for (let j = i - dPeriod + 1; j <= i; j++) sum += kValues[j]!.k;
    result.push({
      date: kValues[i]!.date,
      k: kValues[i]!.k,
      d: sum / dPeriod,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Compute EMA over an arbitrary array of numbers.
 * Returns `n − period + 1` values, aligned starting at index `period − 1`.
 * First value is seeded with SMA of the first `period` elements.
 */
function emaFromValues(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const result: number[] = [];

  let ema = 0;
  for (let i = 0; i < period; i++) ema += values[i]!;
  ema /= period;
  result.push(ema);

  for (let i = period; i < values.length; i++) {
    ema = values[i]! * k + ema * (1 - k);
    result.push(ema);
  }

  return result;
}
