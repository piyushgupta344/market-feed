import { describe, expect, it, vi } from "vitest";
import { screen } from "../../../src/screener/index.js";
import type { Quote } from "../../../src/types/quote.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    symbol: "AAPL",
    name: "Apple Inc.",
    price: 190,
    change: 2,
    changePercent: 1.06,
    open: 188,
    high: 191,
    low: 187,
    close: 190,
    previousClose: 188,
    volume: 50_000_000,
    marketCap: 3_000_000_000_000,
    fiftyTwoWeekHigh: 210,
    fiftyTwoWeekLow: 164,
    currency: "USD",
    exchange: "NASDAQ",
    timestamp: new Date(),
    provider: "test",
    ...overrides,
  };
}

function makeSource(quotes: Quote[]) {
  return {
    quote: vi.fn().mockResolvedValue(quotes),
  };
}

// ---------------------------------------------------------------------------
// Basic screening
// ---------------------------------------------------------------------------

describe("screen() — basic", () => {
  it("returns all symbols when no criteria filter anything out", async () => {
    const source = makeSource([
      makeQuote({ symbol: "AAPL" }),
      makeQuote({ symbol: "MSFT" }),
    ]);

    const results = await screen(source, ["AAPL", "MSFT"], {
      criteria: [{ type: "price_above", value: 0 }],
    });

    expect(results).toHaveLength(2);
    expect(results[0]?.symbol).toBe("AAPL");
  });

  it("returns empty array when symbols list is empty", async () => {
    const source = makeSource([]);
    const results = await screen(source, [], { criteria: [{ type: "price_above", value: 100 }] });
    expect(results).toEqual([]);
  });

  it("returns empty array when criteria list is empty", async () => {
    const source = makeSource([makeQuote()]);
    const results = await screen(source, ["AAPL"], { criteria: [] });
    expect(results).toEqual([]);
  });

  it("returns correct matchedCriteria count", async () => {
    const source = makeSource([makeQuote()]);
    const results = await screen(source, ["AAPL"], {
      criteria: [
        { type: "price_above", value: 0 },
        { type: "volume_above", value: 0 },
      ],
    });
    expect(results[0]?.matchedCriteria).toBe(2);
  });

  it("includes the full Quote object in the result", async () => {
    const quote = makeQuote({ symbol: "AAPL", price: 190 });
    const source = makeSource([quote]);
    const [result] = await screen(source, ["AAPL"], {
      criteria: [{ type: "price_above", value: 100 }],
    });
    expect(result?.quote).toBe(quote);
  });
});

// ---------------------------------------------------------------------------
// price_above / price_below
// ---------------------------------------------------------------------------

describe("screen() — price criteria", () => {
  it("filters by price_above", async () => {
    const source = makeSource([
      makeQuote({ symbol: "AAPL", price: 190 }),
      makeQuote({ symbol: "TSLA", price: 50 }),
    ]);

    const results = await screen(source, ["AAPL", "TSLA"], {
      criteria: [{ type: "price_above", value: 100 }],
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.symbol).toBe("AAPL");
  });

  it("filters by price_below", async () => {
    const source = makeSource([
      makeQuote({ symbol: "AAPL", price: 190 }),
      makeQuote({ symbol: "TSLA", price: 50 }),
    ]);

    const results = await screen(source, ["AAPL", "TSLA"], {
      criteria: [{ type: "price_below", value: 100 }],
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.symbol).toBe("TSLA");
  });
});

// ---------------------------------------------------------------------------
// change_pct criteria
// ---------------------------------------------------------------------------

describe("screen() — change_pct criteria", () => {
  it("filters by change_pct_above", async () => {
    const source = makeSource([
      makeQuote({ symbol: "AAPL", changePercent: 3.5 }),
      makeQuote({ symbol: "TSLA", changePercent: 0.5 }),
    ]);

    const results = await screen(source, ["AAPL", "TSLA"], {
      criteria: [{ type: "change_pct_above", value: 2 }],
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.symbol).toBe("AAPL");
  });

  it("filters by change_pct_below (negative days)", async () => {
    const source = makeSource([
      makeQuote({ symbol: "AAPL", changePercent: -6 }),
      makeQuote({ symbol: "MSFT", changePercent: -1 }),
    ]);

    const results = await screen(source, ["AAPL", "MSFT"], {
      criteria: [{ type: "change_pct_below", value: -5 }],
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.symbol).toBe("AAPL");
  });
});

// ---------------------------------------------------------------------------
// volume criteria
// ---------------------------------------------------------------------------

describe("screen() — volume criteria", () => {
  it("filters by volume_above", async () => {
    const source = makeSource([
      makeQuote({ symbol: "AAPL", volume: 50_000_000 }),
      makeQuote({ symbol: "TSLA", volume: 5_000_000 }),
    ]);

    const results = await screen(source, ["AAPL", "TSLA"], {
      criteria: [{ type: "volume_above", value: 10_000_000 }],
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.symbol).toBe("AAPL");
  });

  it("filters by volume_below", async () => {
    const source = makeSource([
      makeQuote({ symbol: "AAPL", volume: 50_000_000 }),
      makeQuote({ symbol: "TSLA", volume: 5_000_000 }),
    ]);

    const results = await screen(source, ["AAPL", "TSLA"], {
      criteria: [{ type: "volume_below", value: 10_000_000 }],
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.symbol).toBe("TSLA");
  });
});

// ---------------------------------------------------------------------------
// market_cap criteria
// ---------------------------------------------------------------------------

describe("screen() — market_cap criteria", () => {
  it("filters by market_cap_above", async () => {
    const source = makeSource([
      makeQuote({ symbol: "AAPL", marketCap: 3_000_000_000_000 }),
      makeQuote({ symbol: "SMALL", marketCap: 1_000_000_000 }),
    ]);

    const results = await screen(source, ["AAPL", "SMALL"], {
      criteria: [{ type: "market_cap_above", value: 500_000_000_000 }],
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.symbol).toBe("AAPL");
  });

  it("passes market_cap criteria when marketCap is undefined", async () => {
    const source = makeSource([makeQuote({ symbol: "AAPL", marketCap: undefined })]);
    const results = await screen(source, ["AAPL"], {
      criteria: [{ type: "market_cap_above", value: 100 }],
    });
    // undefined marketCap → does NOT pass market_cap_above
    expect(results).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 52-week criteria
// ---------------------------------------------------------------------------

describe("screen() — 52-week criteria", () => {
  it("filters by 52w_high_pct_below (near 52w low)", async () => {
    // price=190, 52w high=210 → pctBelow = (210-190)/210*100 = 9.5%
    const source = makeSource([makeQuote({ price: 190, fiftyTwoWeekHigh: 210 })]);
    const results = await screen(source, ["AAPL"], {
      criteria: [{ type: "52w_high_pct_below", value: 20 }], // within 20% of 52w high → passes
    });
    expect(results).toHaveLength(1);
  });

  it("52w_high_pct_below passes when fiftyTwoWeekHigh is undefined", async () => {
    const source = makeSource([makeQuote({ fiftyTwoWeekHigh: undefined })]);
    const results = await screen(source, ["AAPL"], {
      criteria: [{ type: "52w_high_pct_below", value: 5 }],
    });
    expect(results).toHaveLength(1); // undefined → passes (don't filter)
  });
});

// ---------------------------------------------------------------------------
// custom criterion
// ---------------------------------------------------------------------------

describe("screen() — custom criterion", () => {
  it("supports custom predicate function", async () => {
    const source = makeSource([
      makeQuote({ symbol: "AAPL", price: 190, volume: 50_000_000 }),
      makeQuote({ symbol: "TSLA", price: 50, volume: 10_000_000 }),
    ]);

    const results = await screen(source, ["AAPL", "TSLA"], {
      criteria: [
        {
          type: "custom",
          fn: (q) => q.price > 100 && q.volume > 20_000_000,
        },
      ],
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.symbol).toBe("AAPL");
  });
});

// ---------------------------------------------------------------------------
// Multiple criteria (AND logic)
// ---------------------------------------------------------------------------

describe("screen() — multiple criteria (AND)", () => {
  it("requires ALL criteria to pass", async () => {
    const source = makeSource([
      makeQuote({ symbol: "AAPL", price: 190, changePercent: 3 }),
      makeQuote({ symbol: "TSLA", price: 190, changePercent: 0.5 }), // fails change_pct
      makeQuote({ symbol: "AMZN", price: 50, changePercent: 3 }),    // fails price
    ]);

    const results = await screen(source, ["AAPL", "TSLA", "AMZN"], {
      criteria: [
        { type: "price_above", value: 100 },
        { type: "change_pct_above", value: 2 },
      ],
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.symbol).toBe("AAPL");
  });
});

// ---------------------------------------------------------------------------
// limit and batching
// ---------------------------------------------------------------------------

describe("screen() — limit and batching", () => {
  it("respects limit option", async () => {
    const source = makeSource([
      makeQuote({ symbol: "AAPL" }),
      makeQuote({ symbol: "MSFT" }),
      makeQuote({ symbol: "GOOGL" }),
    ]);

    const results = await screen(source, ["AAPL", "MSFT", "GOOGL"], {
      criteria: [{ type: "price_above", value: 0 }],
      limit: 2,
    });

    expect(results).toHaveLength(2);
  });

  it("batches quote fetches when batchSize is set", async () => {
    const callCaptures: string[][] = [];
    const source = {
      quote: vi.fn().mockImplementation(async (syms: string[]) => {
        callCaptures.push(syms);
        return syms.map((s) => makeQuote({ symbol: s }));
      }),
    };

    await screen(source, ["A", "B", "C", "D", "E"], {
      criteria: [{ type: "price_above", value: 0 }],
      batchSize: 2,
    });

    // 5 symbols with batchSize 2 → 3 batches
    expect(callCaptures).toHaveLength(3);
    expect(callCaptures[0]).toEqual(["A", "B"]);
    expect(callCaptures[1]).toEqual(["C", "D"]);
    expect(callCaptures[2]).toEqual(["E"]);
  });
});
