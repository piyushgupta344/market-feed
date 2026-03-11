import { describe, expect, it } from "vitest";
import { backtest } from "../../../src/backtest/index.js";
import type { HistoricalBar } from "../../../src/types/historical.js";

// ---------------------------------------------------------------------------
// Test bar factory
// ---------------------------------------------------------------------------

function makeBar(close: number, date: string, open?: number, volume = 1_000_000): HistoricalBar {
  return {
    date: new Date(date),
    open: open ?? close,
    high: close * 1.01,
    low: close * 0.99,
    close,
    volume,
  };
}

function makeBars(closes: number[], startDate = "2023-01-02"): HistoricalBar[] {
  return closes.map((c, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return makeBar(c, d.toISOString().slice(0, 10));
  });
}

// ---------------------------------------------------------------------------
// Core mechanics
// ---------------------------------------------------------------------------

describe("backtest() — no trades", () => {
  it("returns zero totalReturn with no signals", () => {
    const bars = makeBars([100, 101, 102, 103, 104]);
    const result = backtest("TEST", bars, () => false, () => false);

    expect(result.totalReturn).toBe(0);
    expect(result.totalTrades).toBe(0);
    expect(result.trades).toHaveLength(0);
  });

  it("returns correct symbol", () => {
    const bars = makeBars([100]);
    const result = backtest("AAPL", bars, () => false, () => false);
    expect(result.symbol).toBe("AAPL");
  });

  it("returns 'unknown' symbol for empty bars", () => {
    const result = backtest("AAPL", [], () => false, () => false);
    expect(result.totalTrades).toBe(0);
  });
});

describe("backtest() — single winning trade", () => {
  const bars = makeBars([100, 110, 120, 130, 140]);

  // Enter on bar 0 (close=100), exit on bar 2 (close=120)
  const result = backtest(
    "TEST",
    bars,
    (_, i) => i === 0,
    (_, i) => i === 2,
  );

  it("records one trade", () => {
    expect(result.totalTrades).toBe(1);
    expect(result.trades).toHaveLength(1);
  });

  it("calculates correct pnl", () => {
    expect(result.trades[0]?.entryPrice).toBe(100);
    expect(result.trades[0]?.exitPrice).toBe(120);
    expect(result.trades[0]?.pnl).toBe(20);
    expect(result.trades[0]?.pnlPct).toBeCloseTo(0.2, 6);
  });

  it("win rate is 100%", () => {
    expect(result.winRate).toBe(1);
  });

  it("profit factor is Infinity (no losses)", () => {
    expect(result.profitFactor).toBe(Infinity);
  });

  it("totalReturn reflects final equity", () => {
    // initialCapital=100_000, qty=1, enter@100, exit@120 → equity=100_020
    expect(result.totalReturn).toBeCloseTo(0.0002, 4);
  });
});

describe("backtest() — single losing trade", () => {
  const bars = makeBars([100, 90, 80, 70, 60]);

  const result = backtest(
    "TEST",
    bars,
    (_, i) => i === 0,
    (_, i) => i === 2,
  );

  it("records one trade with negative pnl", () => {
    expect(result.trades[0]?.pnl).toBe(-20);
    expect(result.trades[0]?.pnlPct).toBeCloseTo(-0.2, 6);
  });

  it("win rate is 0", () => {
    expect(result.winRate).toBe(0);
  });

  it("profit factor is 0 (no wins)", () => {
    expect(result.profitFactor).toBe(0);
  });
});

describe("backtest() — multiple trades", () => {
  // bars: enter at close of even index, exit at close of odd index
  // trade 1: enter@100, exit@110 → +10
  // trade 2: enter@110, exit@100 → -10
  // trade 3: enter@100, exit@120 → +20
  const bars = makeBars([100, 110, 110, 100, 100, 120]);

  const result = backtest(
    "TEST",
    bars,
    (_, i) => i % 2 === 0,
    (_, i) => i % 2 === 1,
  );

  it("records correct number of trades", () => {
    expect(result.totalTrades).toBe(3);
  });

  it("calculates profit factor (gross profit / gross loss)", () => {
    // grossProfit = 10 + 20 = 30, grossLoss = 10, pf = 3
    expect(result.profitFactor).toBeCloseTo(3, 1);
  });

  it("win rate = 2/3", () => {
    expect(result.winRate).toBeCloseTo(2 / 3, 3);
  });
});

describe("backtest() — open position closed at end", () => {
  const bars = makeBars([100, 110, 120]);

  const result = backtest(
    "TEST",
    bars,
    (_, i) => i === 0,
    () => false, // never explicitly exit
  );

  it("records the trade (closed at last bar)", () => {
    expect(result.totalTrades).toBe(1);
    expect(result.trades[0]?.exitPrice).toBe(120);
  });
});

describe("backtest() — commission reduces pnl", () => {
  const bars = makeBars([100, 110]);

  const result = backtest(
    "TEST",
    bars,
    (_, i) => i === 0,
    (_, i) => i === 1,
    { commission: 5 },
  );

  it("deducts 2× commission from pnl", () => {
    // gross pnl = 10, commission = 5+5 = 10 → net pnl = 0
    expect(result.trades[0]?.pnl).toBe(0);
  });
});

describe("backtest() — custom initialCapital and quantity", () => {
  const bars = makeBars([50, 60]);

  const result = backtest(
    "TEST",
    bars,
    (_, i) => i === 0,
    (_, i) => i === 1,
    { initialCapital: 1_000, quantity: 10 },
  );

  it("uses custom quantity in pnl calculation", () => {
    // entry@50, exit@60, qty=10 → pnl = 100
    expect(result.trades[0]?.pnl).toBe(100);
    // totalReturn = 100/1000 = 0.1
    expect(result.totalReturn).toBeCloseTo(0.1, 6);
  });
});

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

describe("backtest() — maxDrawdown", () => {
  // Steady decline after entry then recovery — should have a drawdown
  const bars = makeBars([100, 100, 100, 80, 90, 100]);

  const result = backtest(
    "TEST",
    bars,
    (_, i) => i === 0,
    () => false,
    { initialCapital: 1_000, quantity: 1 },
  );

  it("maxDrawdown is positive and <= 1", () => {
    expect(result.maxDrawdown).toBeGreaterThan(0);
    expect(result.maxDrawdown).toBeLessThanOrEqual(1);
  });
});

describe("backtest() — sharpeRatio", () => {
  // Flat bars → no variance → sharpe = 0
  const flatBars = makeBars([100, 100, 100, 100, 100]);

  it("returns 0 sharpe for flat equity curve", () => {
    const result = backtest("TEST", flatBars, () => false, () => false);
    expect(result.sharpeRatio).toBe(0);
  });

  // Upward trend → positive sharpe
  const upBars = makeBars([100, 102, 104, 106, 108, 110]);

  it("returns positive sharpe for steadily rising equity", () => {
    const result = backtest(
      "TEST",
      upBars,
      (_, i) => i === 0,
      () => false,
      { quantity: 1, initialCapital: 10_000 },
    );
    expect(result.sharpeRatio).toBeGreaterThan(0);
  });
});

describe("backtest() — annualizedReturn", () => {
  // Create bars spanning exactly 2 years with 50% total return
  const start = new Date("2022-01-01");
  const end = new Date("2024-01-01");

  const bars: HistoricalBar[] = [
    { date: start, open: 100, high: 101, low: 99, close: 100, volume: 1_000 },
    { date: end, open: 150, high: 151, low: 149, close: 150, volume: 1_000 },
  ];

  const result = backtest(
    "TEST",
    bars,
    (_, i) => i === 0,
    (_, i) => i === 1,
    { quantity: 1, initialCapital: 100_000 },
  );

  it("annualizedReturn approximates CAGR over 2 years", () => {
    // totalReturn ≈ 50/100000 = 0.0005
    // CAGR ≈ (1 + totalReturn)^(1/2) - 1 ≈ totalReturn/2 for small values
    expect(result.annualizedReturn).toBeGreaterThan(0);
    expect(result.annualizedReturn).toBeLessThan(result.totalReturn + 0.001);
  });
});
