import { describe, expect, it } from "vitest";
import { portfolioBacktest } from "../../../src/backtest/index.js";
import type { HistoricalBar } from "../../../src/types/historical.js";

function makeBar(close: number, date: string): HistoricalBar {
  return {
    date: new Date(date),
    open: close,
    high: close * 1.01,
    low: close * 0.99,
    close,
    volume: 1_000_000,
  };
}

function makeBars(closes: number[], startDate = "2023-01-02"): HistoricalBar[] {
  return closes.map((c, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return makeBar(c, d.toISOString().slice(0, 10));
  });
}

// Trivial signals: always enter on bar 1, always exit on bar 3
const alwaysEnter = (_bars: readonly HistoricalBar[], i: number) => i === 1;
const alwaysExit = (_bars: readonly HistoricalBar[], i: number) => i === 3;

// ---------------------------------------------------------------------------
// Basic multi-asset operation
// ---------------------------------------------------------------------------

describe("portfolioBacktest()", () => {
  it("returns empty result for empty assets array", () => {
    const result = portfolioBacktest([]);
    expect(result.totalReturn).toBe(0);
    expect(result.totalTrades).toBe(0);
    expect(result.trades).toHaveLength(0);
    expect(result.equityCurve).toHaveLength(0);
  });

  it("runs two assets sharing a cash pool", () => {
    const aaplBars = makeBars([100, 102, 104, 106, 108]);
    const msftBars = makeBars([200, 204, 208, 212, 216]);

    const result = portfolioBacktest(
      [
        { symbol: "AAPL", bars: aaplBars, entry: alwaysEnter, exit: alwaysExit },
        { symbol: "MSFT", bars: msftBars, entry: alwaysEnter, exit: alwaysExit },
      ],
      { initialCapital: 50_000, sizing: { type: "fixed_quantity", quantity: 1 } },
    );

    // Should have trades for both symbols
    const aaplTrades = result.trades.filter((t) => t.symbol === "AAPL");
    const msftTrades = result.trades.filter((t) => t.symbol === "MSFT");
    expect(aaplTrades).toHaveLength(1);
    expect(msftTrades).toHaveLength(1);

    // AAPL: entry at 102, exit at 106 → pnl = 4
    expect(aaplTrades[0]?.entryPrice).toBe(102);
    expect(aaplTrades[0]?.exitPrice).toBe(106);
    expect(aaplTrades[0]?.pnl).toBeCloseTo(4, 5);

    // MSFT: entry at 204, exit at 212 → pnl = 8
    expect(msftTrades[0]?.entryPrice).toBe(204);
    expect(msftTrades[0]?.exitPrice).toBe(212);
    expect(msftTrades[0]?.pnl).toBeCloseTo(8, 5);
  });

  it("produces an equity curve with a snapshot per unique date", () => {
    const bars = makeBars([100, 101, 102, 103, 104]);
    const result = portfolioBacktest(
      [{ symbol: "AAPL", bars, entry: alwaysEnter, exit: alwaysExit }],
      { initialCapital: 10_000 },
    );
    expect(result.equityCurve).toHaveLength(bars.length);
    for (const { date, equity } of result.equityCurve) {
      expect(date).toBeInstanceOf(Date);
      expect(equity).toBeGreaterThan(0);
    }
  });

  it("respects fixed_dollar sizing", () => {
    const bars = makeBars([100, 100, 100, 100, 100]);
    const result = portfolioBacktest(
      [{ symbol: "X", bars, entry: alwaysEnter, exit: alwaysExit }],
      { initialCapital: 10_000, sizing: { type: "fixed_dollar", amount: 500 } },
    );
    // At price 100, fixed_dollar 500 → qty = floor(500/100) = 5
    const trade = result.trades[0];
    expect(trade?.quantity).toBe(5);
  });

  it("respects percent_equity sizing", () => {
    const bars = makeBars([100, 100, 100, 100, 100]);
    const result = portfolioBacktest(
      [{ symbol: "X", bars, entry: alwaysEnter, exit: alwaysExit }],
      { initialCapital: 10_000, sizing: { type: "percent_equity", pct: 10 } },
    );
    // 10% of 10_000 = 1000, at price 100 → qty = floor(1000/100) = 10
    const trade = result.trades[0];
    expect(trade?.quantity).toBe(10);
  });

  it("does not enter when cash is insufficient", () => {
    const bars = makeBars([100, 1000, 1000, 1000, 1000]);
    // price jumps to 1000 at bar 1 — entry would cost 1000 but capital is 500
    const result = portfolioBacktest(
      [{ symbol: "X", bars, entry: alwaysEnter, exit: alwaysExit }],
      { initialCapital: 500, sizing: { type: "fixed_quantity", quantity: 1 } },
    );
    expect(result.totalTrades).toBe(0);
  });

  it("computes totalReturn correctly for a simple gain", () => {
    const bars = makeBars([100, 100, 110, 110, 110]);
    const result = portfolioBacktest(
      [{ symbol: "X", bars, entry: alwaysEnter, exit: alwaysExit }],
      { initialCapital: 1_000, sizing: { type: "fixed_quantity", quantity: 10 } },
    );
    // Entry 100×10=1000 (uses all cash), exit 110×10=1100 → return = 10%
    expect(result.totalReturn).toBeCloseTo(0.1, 5);
  });

  it("populates byAsset summary correctly", () => {
    const aaplBars = makeBars([100, 100, 110, 110, 110]);
    const result = portfolioBacktest(
      [{ symbol: "AAPL", bars: aaplBars, entry: alwaysEnter, exit: alwaysExit }],
      { initialCapital: 10_000, sizing: { type: "fixed_quantity", quantity: 1 } },
    );
    expect(result.byAsset["AAPL"]).toBeDefined();
    expect(result.byAsset["AAPL"]?.totalTrades).toBe(1);
    expect(result.byAsset["AAPL"]?.winRate).toBe(1);
    expect(result.byAsset["AAPL"]?.totalPnl).toBeCloseTo(10);
  });

  it("handles benchmark comparison", () => {
    const bars = makeBars([100, 100, 100, 100, 100]);
    const benchmarkBars = makeBars([100, 105, 110, 115, 120]); // +20% return
    const result = portfolioBacktest(
      [{ symbol: "X", bars, entry: alwaysEnter, exit: alwaysExit }],
      {
        initialCapital: 10_000,
        benchmarkBars,
        benchmarkSymbol: "SPY",
      },
    );
    expect(result.benchmarkReturn).toBeCloseTo(0.2, 5);
    expect(result.benchmarkAnnualizedReturn).toBeDefined();
    expect(result.benchmarkSymbol).toBe("SPY");
  });

  it("handles commission in pnl calculation", () => {
    const bars = makeBars([100, 100, 110, 110, 110]);
    const result = portfolioBacktest(
      [{ symbol: "X", bars, entry: alwaysEnter, exit: alwaysExit }],
      { initialCapital: 10_000, commission: 5, sizing: { type: "fixed_quantity", quantity: 1 } },
    );
    // pnl = (110-100)*1 - 2*5 = 10 - 10 = 0
    expect(result.trades[0]?.pnl).toBeCloseTo(0, 5);
  });

  it("returns totalReturn=0 and empty equityCurve for empty assets", () => {
    const result = portfolioBacktest([]);
    expect(result.totalReturn).toBe(0);
    expect(result.equityCurve).toHaveLength(0);
    expect(result.byAsset).toEqual({});
  });

  it("supports per-asset sizing override", () => {
    const bars = makeBars([100, 100, 100, 100, 100]);
    const result = portfolioBacktest(
      [
        {
          symbol: "X",
          bars,
          entry: alwaysEnter,
          exit: alwaysExit,
          sizing: { type: "fixed_quantity", quantity: 7 },
        },
      ],
      { initialCapital: 10_000, sizing: { type: "fixed_quantity", quantity: 1 } },
    );
    expect(result.trades[0]?.quantity).toBe(7);
  });
});
