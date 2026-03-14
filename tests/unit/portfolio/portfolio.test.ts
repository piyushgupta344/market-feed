import { describe, expect, it, vi } from "vitest";
import { Portfolio } from "../../../src/portfolio/index.js";
import type { Quote } from "../../../src/types/quote.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQuote(symbol: string, price: number, change: number, changePct: number): Quote {
  return {
    symbol,
    name: symbol,
    price,
    change,
    changePercent: changePct,
    open: price,
    high: price,
    low: price,
    close: price,
    previousClose: price - change,
    volume: 1_000_000,
    currency: "USD",
    exchange: "NASDAQ",
    timestamp: new Date(),
    provider: "yahoo",
  };
}

function mockFeed(quotes: Quote[]) {
  return {
    quote: vi.fn().mockResolvedValue(quotes),
  };
}

// ---------------------------------------------------------------------------
// Construction / mutation
// ---------------------------------------------------------------------------

describe("Portfolio", () => {
  describe("constructor", () => {
    it("initialises with given positions", () => {
      const p = new Portfolio([
        { symbol: "AAPL", quantity: 10, avgCost: 150 },
        { symbol: "MSFT", quantity: 5, avgCost: 280 },
      ]);
      expect(p.size).toBe(2);
    });

    it("normalises symbol casing on construction", () => {
      const p = new Portfolio([{ symbol: "aapl", quantity: 1, avgCost: 150 }]);
      expect(p.get("AAPL")).toBeDefined();
    });

    it("starts empty with no arguments", () => {
      expect(new Portfolio().size).toBe(0);
    });
  });

  describe("add()", () => {
    it("adds a new position", () => {
      const p = new Portfolio();
      p.add({ symbol: "AAPL", quantity: 10, avgCost: 150 });
      expect(p.size).toBe(1);
    });

    it("replaces an existing position for the same symbol", () => {
      const p = new Portfolio([{ symbol: "AAPL", quantity: 10, avgCost: 150 }]);
      p.add({ symbol: "AAPL", quantity: 20, avgCost: 160 });
      expect(p.size).toBe(1);
      expect(p.get("AAPL")?.quantity).toBe(20);
      expect(p.get("AAPL")?.avgCost).toBe(160);
    });

    it("is chainable", () => {
      const p = new Portfolio();
      const result = p
        .add({ symbol: "AAPL", quantity: 1, avgCost: 100 })
        .add({ symbol: "MSFT", quantity: 2, avgCost: 200 });
      expect(result).toBe(p);
      expect(p.size).toBe(2);
    });
  });

  describe("remove()", () => {
    it("removes an existing position", () => {
      const p = new Portfolio([{ symbol: "AAPL", quantity: 10, avgCost: 150 }]);
      p.remove("AAPL");
      expect(p.size).toBe(0);
    });

    it("is a no-op for unknown symbol", () => {
      const p = new Portfolio([{ symbol: "AAPL", quantity: 10, avgCost: 150 }]);
      p.remove("MSFT");
      expect(p.size).toBe(1);
    });

    it("is case-insensitive", () => {
      const p = new Portfolio([{ symbol: "AAPL", quantity: 10, avgCost: 150 }]);
      p.remove("aapl");
      expect(p.size).toBe(0);
    });
  });

  describe("list()", () => {
    it("returns all positions as a readonly array", () => {
      const p = new Portfolio([
        { symbol: "AAPL", quantity: 10, avgCost: 150 },
        { symbol: "MSFT", quantity: 5, avgCost: 280 },
      ]);
      const list = p.list();
      expect(list).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // snapshot()
  // ---------------------------------------------------------------------------

  describe("snapshot()", () => {
    it("returns empty snapshot for empty portfolio", async () => {
      const p = new Portfolio();
      const feed = mockFeed([]);
      const snap = await p.snapshot(feed);

      expect(snap.positions).toHaveLength(0);
      expect(snap.totalCostBasis).toBe(0);
      expect(snap.totalMarketValue).toBe(0);
      expect(snap.totalUnrealizedPnl).toBe(0);
      expect(snap.asOf).toBeInstanceOf(Date);
    });

    it("calculates correct P&L for a long position", async () => {
      const p = new Portfolio([{ symbol: "AAPL", quantity: 10, avgCost: 150 }]);
      const feed = mockFeed([makeQuote("AAPL", 190, 2, 1.06)]);
      const snap = await p.snapshot(feed);

      const pos = snap.positions[0]!;
      expect(pos.currentPrice).toBe(190);
      expect(pos.marketValue).toBe(1900); // 10 * 190
      expect(pos.costBasis).toBe(1500); // 10 * 150
      expect(pos.unrealizedPnl).toBe(400); // 1900 - 1500
      expect(pos.unrealizedPnlPct).toBeCloseTo(400 / 1500, 5);
      expect(pos.dayChange).toBe(20); // 10 * 2
      expect(pos.dayChangePct).toBe(1.06);
    });

    it("calculates correct P&L for a short position (negative quantity)", async () => {
      // Short 5 shares at 200, current price 180 → profit of (200-180)*5=100
      const p = new Portfolio([{ symbol: "TSLA", quantity: -5, avgCost: 200 }]);
      const feed = mockFeed([makeQuote("TSLA", 180, -5, -2.7)]);
      const snap = await p.snapshot(feed);

      const pos = snap.positions[0]!;
      expect(pos.marketValue).toBe(-900); // -5 * 180
      expect(pos.costBasis).toBe(-1000); // -5 * 200
      expect(pos.unrealizedPnl).toBe(100); // -900 - (-1000)
      expect(pos.unrealizedPnlPct).toBeCloseTo(100 / 1000, 5);
    });

    it("aggregates totals across multiple positions", async () => {
      const p = new Portfolio([
        { symbol: "AAPL", quantity: 10, avgCost: 150 },
        { symbol: "MSFT", quantity: 5, avgCost: 280 },
      ]);
      const feed = mockFeed([makeQuote("AAPL", 190, 2, 1.06), makeQuote("MSFT", 300, 5, 1.69)]);
      const snap = await p.snapshot(feed);

      expect(snap.totalCostBasis).toBe(10 * 150 + 5 * 280); // 1500 + 1400 = 2900
      expect(snap.totalMarketValue).toBe(10 * 190 + 5 * 300); // 1900 + 1500 = 3400
      expect(snap.totalUnrealizedPnl).toBe(3400 - 2900); // 500
      expect(snap.totalUnrealizedPnlPct).toBeCloseTo(500 / 2900, 5);
    });

    it("calls feed.quote with all symbols", async () => {
      const p = new Portfolio([
        { symbol: "AAPL", quantity: 1, avgCost: 100 },
        { symbol: "MSFT", quantity: 1, avgCost: 200 },
      ]);
      const feed = mockFeed([makeQuote("AAPL", 110, 1, 0.9), makeQuote("MSFT", 210, 1, 0.5)]);
      await p.snapshot(feed);

      expect(feed.quote).toHaveBeenCalledWith(expect.arrayContaining(["AAPL", "MSFT"]));
    });

    it("includes quote in each PositionSnapshot", async () => {
      const p = new Portfolio([{ symbol: "AAPL", quantity: 1, avgCost: 100 }]);
      const quote = makeQuote("AAPL", 110, 1, 0.9);
      const feed = mockFeed([quote]);
      const snap = await p.snapshot(feed);

      expect(snap.positions[0]?.quote).toEqual(quote);
    });

    it("skips positions where feed returns no quote", async () => {
      const p = new Portfolio([
        { symbol: "AAPL", quantity: 1, avgCost: 100 },
        { symbol: "NODATA", quantity: 1, avgCost: 50 },
      ]);
      // Feed only returns AAPL
      const feed = mockFeed([makeQuote("AAPL", 110, 1, 0.9)]);
      const snap = await p.snapshot(feed);

      expect(snap.positions).toHaveLength(1);
      expect(snap.positions[0]?.symbol).toBe("AAPL");
    });
  });
});
