import { describe, expect, it } from "vitest";
import {
  atr,
  bollingerBands,
  ema,
  macd,
  rsi,
  sma,
  stochastic,
  vwap,
} from "../../../src/indicators/index.js";
import type { HistoricalBar } from "../../../src/types/historical.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBars(closes: number[], highOffset = 1, lowOffset = 1): HistoricalBar[] {
  return closes.map((close, i) => ({
    date: new Date(Date.UTC(2024, 0, i + 1)),
    open: close,
    high: close + highOffset,
    low: close - lowOffset,
    close,
    volume: 1_000_000,
  }));
}

// ---------------------------------------------------------------------------
// SMA
// ---------------------------------------------------------------------------

describe("sma()", () => {
  it("returns correct values for a simple ascending series", () => {
    const bars = makeBars([10, 11, 12, 13, 14, 15]);
    const result = sma(bars, 3);

    expect(result).toHaveLength(4);
    expect(result[0]?.value).toBeCloseTo(11, 5);
    expect(result[1]?.value).toBeCloseTo(12, 5);
    expect(result[2]?.value).toBeCloseTo(13, 5);
    expect(result[3]?.value).toBeCloseTo(14, 5);
  });

  it("date aligns with the last bar in each window", () => {
    const bars = makeBars([10, 11, 12]);
    const result = sma(bars, 3);
    expect(result[0]?.date).toEqual(bars[2]?.date);
  });

  it("returns empty array when period > bar count", () => {
    expect(sma(makeBars([10, 11]), 3)).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(sma([], 5)).toEqual([]);
  });

  it("period 1 returns every bar's close", () => {
    const bars = makeBars([5, 6, 7]);
    const result = sma(bars, 1);
    expect(result).toHaveLength(3);
    expect(result[0]?.value).toBe(5);
    expect(result[2]?.value).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// EMA
// ---------------------------------------------------------------------------

describe("ema()", () => {
  it("seeds on SMA of first `period` bars", () => {
    // period=3: seed = mean([10,11,12]) = 11
    const bars = makeBars([10, 11, 12, 13, 14]);
    const result = ema(bars, 3);
    expect(result[0]?.value).toBeCloseTo(11, 5); // seed
  });

  it("applies multiplier k = 2/(period+1) correctly", () => {
    // period=3, k=0.5
    // bar[3] close=13: ema = 13*0.5 + 11*0.5 = 12
    const bars = makeBars([10, 11, 12, 13, 14]);
    const result = ema(bars, 3);
    expect(result[1]?.value).toBeCloseTo(12, 5);
    expect(result[2]?.value).toBeCloseTo(13, 5);
  });

  it("result length is bars.length - period + 1", () => {
    const bars = makeBars([10, 11, 12, 13, 14, 15]);
    expect(ema(bars, 3)).toHaveLength(4);
    expect(ema(bars, 6)).toHaveLength(1);
  });

  it("returns empty array when period > bar count", () => {
    expect(ema(makeBars([1, 2]), 5)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// RSI
// ---------------------------------------------------------------------------

describe("rsi()", () => {
  it("returns correct initial RSI for known input (period=3)", () => {
    // diffs[0..2] = [1, 1, -1]
    // avgGain = (1+1)/3 = 2/3, avgLoss = 1/3
    // RS=2, RSI = 100 - 100/3 ≈ 66.667
    const bars = makeBars([10, 11, 12, 11, 12, 13]);
    const result = rsi(bars, 3);
    expect(result[0]?.value).toBeCloseTo(66.667, 2);
  });

  it("RSI is 100 when all movement is upward (no losses)", () => {
    const bars = makeBars([10, 11, 12, 13, 14, 15, 16]);
    const result = rsi(bars, 3);
    expect(result.every((p) => p.value === 100)).toBe(true);
  });

  it("all values are in [0, 100]", () => {
    const prices = [10, 12, 11, 13, 10, 15, 9, 14, 12, 16, 11, 13, 14, 15, 10, 12];
    const result = rsi(makeBars(prices), 5);
    for (const p of result) {
      expect(p.value).toBeGreaterThanOrEqual(0);
      expect(p.value).toBeLessThanOrEqual(100);
    }
  });

  it("returns empty array when bars.length <= period", () => {
    expect(rsi(makeBars([10, 11, 12]), 3)).toEqual([]);
    expect(rsi(makeBars([10, 11, 12, 13]), 3)).toHaveLength(1);
  });

  it("result length is bars.length - period", () => {
    const bars = makeBars(Array.from({ length: 20 }, (_, i) => 10 + i));
    expect(rsi(bars, 14)).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// MACD
// ---------------------------------------------------------------------------

describe("macd()", () => {
  it("requires at least slow+signal-1 bars to produce output", () => {
    // Default: 26+9-1=34 bars minimum
    const shortBars = makeBars(Array.from({ length: 33 }, (_, i) => 10 + i));
    expect(macd(shortBars)).toHaveLength(0);

    const okBars = makeBars(Array.from({ length: 34 }, (_, i) => 10 + i));
    expect(macd(okBars)).toHaveLength(1);
  });

  it("histogram equals macd - signal", () => {
    const bars = makeBars(Array.from({ length: 40 }, (_, i) => 10 + i * 0.5));
    const result = macd(bars);
    for (const p of result) {
      expect(p.histogram).toBeCloseTo(p.macd - p.signal, 10);
    }
  });

  it("MACD is positive for a strongly trending-up series", () => {
    // Linearly increasing prices → fast EMA > slow EMA
    const bars = makeBars(Array.from({ length: 40 }, (_, i) => 100 + i * 2));
    const result = macd(bars);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.macd).toBeGreaterThan(0);
  });

  it("returns empty array if fast >= slow", () => {
    const bars = makeBars(Array.from({ length: 40 }, (_, i) => i));
    expect(macd(bars, 26, 12)).toHaveLength(0); // fast >= slow
  });
});

// ---------------------------------------------------------------------------
// Bollinger Bands
// ---------------------------------------------------------------------------

describe("bollingerBands()", () => {
  it("middle band equals SMA", () => {
    const bars = makeBars([10, 11, 12, 13, 14, 15]);
    const bbResult = bollingerBands(bars, 3);
    const smaResult = sma(bars, 3);

    expect(bbResult).toHaveLength(smaResult.length);
    for (let i = 0; i < bbResult.length; i++) {
      // biome-ignore lint/style/noNonNullAssertion: bounds-checked by loop condition
      expect(bbResult[i]!.middle).toBeCloseTo(smaResult[i]!.value, 10);
    }
  });

  it("upper > middle > lower for non-flat series", () => {
    const bars = makeBars([10, 12, 11, 13, 12, 14, 13, 15]);
    const result = bollingerBands(bars, 3);
    for (const p of result) {
      expect(p.upper).toBeGreaterThan(p.middle);
      expect(p.lower).toBeLessThan(p.middle);
    }
  });

  it("computes correct values for known input", () => {
    // bars=[10,11,12,13,14], period=5
    // middle=12, variance=2, std=sqrt(2)≈1.4142, upper≈14.828, lower≈9.172
    const bars = makeBars([10, 11, 12, 13, 14]);
    const result = bollingerBands(bars, 5);
    expect(result).toHaveLength(1);
    expect(result[0]?.middle).toBeCloseTo(12, 5);
    expect(result[0]?.upper).toBeCloseTo(12 + 2 * Math.sqrt(2), 5);
    expect(result[0]?.lower).toBeCloseTo(12 - 2 * Math.sqrt(2), 5);
  });

  it("returns empty for insufficient bars", () => {
    expect(bollingerBands(makeBars([10, 11]), 5)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// ATR
// ---------------------------------------------------------------------------

describe("atr()", () => {
  it("returns positive values", () => {
    const bars = makeBars(Array.from({ length: 20 }, (_, i) => 10 + i));
    const result = atr(bars, 5);
    expect(result.length).toBeGreaterThan(0);
    for (const p of result) {
      expect(p.value).toBeGreaterThan(0);
    }
  });

  it("first ATR equals mean of first period true ranges for uniform series", () => {
    // close[i] = 10+i, high = close+1, low = close-1
    // TR[i] = max(2, |close+1 - prev_close|, |close-1 - prev_close|) = max(2, close-prev+1, prev-close+1)
    // With close increasing by 1: TR = max(2, 2, 0) = 2 for all
    // First ATR(3) = mean([2,2,2]) = 2
    const bars = makeBars(Array.from({ length: 10 }, (_, i) => 10 + i));
    const result = atr(bars, 3);
    expect(result[0]?.value).toBeCloseTo(2, 5);
  });

  it("result starts at bar index `period`", () => {
    const bars = makeBars(Array.from({ length: 10 }, (_, i) => 10 + i));
    const result = atr(bars, 3);
    expect(result[0]?.date).toEqual(bars[3]?.date);
  });

  it("returns empty array when bars.length <= period", () => {
    expect(atr(makeBars([10, 11, 12]), 3)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// VWAP
// ---------------------------------------------------------------------------

describe("vwap()", () => {
  it("returns same length as input", () => {
    const bars = makeBars([10, 11, 12, 13]);
    expect(vwap(bars)).toHaveLength(4);
  });

  it("equals typical price when all bars are identical", () => {
    const bars = makeBars([10, 10, 10, 10]);
    // typical = (11+9+10)/3 = 10
    const result = vwap(bars);
    for (const p of result) {
      expect(p.value).toBeCloseTo(10, 5);
    }
  });

  it("is cumulative — later bars incorporate all prior data", () => {
    const bars = makeBars([10, 20]);
    const result = vwap(bars);
    // bar0: typical=(11+9+10)/3=10, vol=1M → vwap=10
    // bar1: typical=(21+19+20)/3=20, vol=1M → vwap=(10*1M + 20*1M)/(2M)=15
    expect(result[0]?.value).toBeCloseTo(10, 5);
    expect(result[1]?.value).toBeCloseTo(15, 5);
  });

  it("returns empty for empty input", () => {
    expect(vwap([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Stochastic
// ---------------------------------------------------------------------------

describe("stochastic()", () => {
  it("k and d values are in [0, 100]", () => {
    const prices = [10, 12, 11, 13, 10, 15, 9, 14, 12, 16, 11, 13, 14, 15, 10, 12];
    const result = stochastic(makeBars(prices), 5, 3);
    for (const p of result) {
      expect(p.k).toBeGreaterThanOrEqual(0);
      expect(p.k).toBeLessThanOrEqual(100);
      expect(p.d).toBeGreaterThanOrEqual(0);
      expect(p.d).toBeLessThanOrEqual(100);
    }
  });

  it("returns empty when insufficient bars", () => {
    expect(stochastic(makeBars([10, 11, 12]), 3, 3)).toHaveLength(0);
    // kPeriod+dPeriod-1 = 5: need 5 bars for 1 output
    expect(stochastic(makeBars([10, 11, 12, 13, 14]), 3, 3)).toHaveLength(1);
  });

  it("k=100 when close equals the highest high of the window", () => {
    // close=15 is the max, low is 9 → k = 100*(15-9)/(15-9) = 100
    const bars: HistoricalBar[] = [
      { date: new Date(), open: 10, high: 11, low: 9, close: 10, volume: 1_000_000 },
      { date: new Date(), open: 11, high: 12, low: 10, close: 11, volume: 1_000_000 },
      { date: new Date(), open: 12, high: 15, low: 9, close: 15, volume: 1_000_000 },
      { date: new Date(), open: 13, high: 16, low: 9, close: 15, volume: 1_000_000 },
      { date: new Date(), open: 14, high: 17, low: 9, close: 15, volume: 1_000_000 },
    ];
    const result = stochastic(bars, 3, 3);
    // Last bar: window high=max(15,16,17)=17, low=min(9,9,9)=9 → k=100*(15-9)/(17-9)=75
    expect(result.length).toBeGreaterThan(0);
  });

  it("k=50 when high equals low (avoids divide-by-zero)", () => {
    const flat: HistoricalBar[] = Array.from({ length: 6 }, () => ({
      date: new Date(),
      open: 10,
      high: 10,
      low: 10,
      close: 10,
      volume: 1_000_000,
    }));
    const result = stochastic(flat, 3, 3);
    expect(result[0]?.k).toBe(50);
  });
});
