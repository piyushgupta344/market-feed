import { describe, expect, it, vi } from "vitest";
import { ProviderError } from "../../../src/errors.js";
import { FinnhubProvider } from "../../../src/providers/finnhub/index.js";
import { PolygonProvider } from "../../../src/providers/polygon/index.js";
import { YahooProvider } from "../../../src/providers/yahoo/index.js";
import finnhubEarningsFixture from "../../fixtures/finnhub-earnings.json";
import polygonDividendsFixture from "../../fixtures/polygon-dividends.json";
import polygonSplitsFixture from "../../fixtures/polygon-splits.json";
import yahooDividendsFixture from "../../fixtures/yahoo-dividends.json";
import yahooEarningsFixture from "../../fixtures/yahoo-earnings.json";
import yahooSplitsFixture from "../../fixtures/yahoo-splits.json";

function mockFetch(fixture: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status,
      statusText: ok ? "OK" : "Error",
      headers: { get: () => "application/json" },
      json: async () => fixture,
    }),
  );
}

// ---------------------------------------------------------------------------
// Yahoo — earnings
// ---------------------------------------------------------------------------

describe("YahooProvider.earnings()", () => {
  it("returns normalised EarningsEvent array", async () => {
    mockFetch(yahooEarningsFixture);
    const provider = new YahooProvider();
    const events = await provider.earnings("AAPL");

    expect(events.length).toBeGreaterThan(0);
    const e = events[0]!;
    expect(e.symbol).toBe("AAPL");
    expect(e.date).toBeInstanceOf(Date);
    expect(e.epsActual).toBe(1.53);
    expect(e.epsEstimate).toBe(1.5);
    expect(e.epsSurprisePct).toBe(2.0);
    expect(e.provider).toBe("yahoo");

    vi.unstubAllGlobals();
  });

  it("returns events sorted most-recent first", async () => {
    mockFetch(yahooEarningsFixture);
    const provider = new YahooProvider();
    const events = await provider.earnings("AAPL");

    for (let i = 1; i < events.length; i++) {
      // biome-ignore lint/style/noNonNullAssertion: bounds-checked by loop condition
      expect(events[i - 1]!.date.getTime()).toBeGreaterThanOrEqual(events[i]!.date.getTime());
    }

    vi.unstubAllGlobals();
  });

  it("respects limit option", async () => {
    mockFetch(yahooEarningsFixture);
    const provider = new YahooProvider();
    const events = await provider.earnings("AAPL", { limit: 1 });

    expect(events).toHaveLength(1);

    vi.unstubAllGlobals();
  });

  it("includes raw response when raw:true", async () => {
    mockFetch(yahooEarningsFixture);
    const provider = new YahooProvider();
    const events = await provider.earnings("AAPL", { raw: true });

    expect(events[0]?.raw).toBeDefined();

    vi.unstubAllGlobals();
  });

  it("throws ProviderError when quoteSummary result is empty", async () => {
    mockFetch({
      quoteSummary: { result: null, error: { code: "Not Found", description: "No data" } },
    });
    const provider = new YahooProvider();

    await expect(provider.earnings("INVALID")).rejects.toThrow(ProviderError);

    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// Yahoo — dividends
// ---------------------------------------------------------------------------

describe("YahooProvider.dividends()", () => {
  it("returns normalised DividendEvent array", async () => {
    mockFetch(yahooDividendsFixture);
    const provider = new YahooProvider();
    const events = await provider.dividends("AAPL");

    expect(events.length).toBeGreaterThan(0);
    const e = events[0]!;
    expect(e.symbol).toBe("AAPL");
    expect(e.exDate).toBeInstanceOf(Date);
    expect(e.amount).toBe(0.25);
    expect(e.currency).toBe("USD");
    expect(e.provider).toBe("yahoo");

    vi.unstubAllGlobals();
  });

  it("returns events sorted most-recent first", async () => {
    mockFetch(yahooDividendsFixture);
    const provider = new YahooProvider();
    const events = await provider.dividends("AAPL");

    for (let i = 1; i < events.length; i++) {
      // biome-ignore lint/style/noNonNullAssertion: bounds-checked by loop condition
      expect(events[i - 1]!.exDate.getTime()).toBeGreaterThanOrEqual(events[i]!.exDate.getTime());
    }

    vi.unstubAllGlobals();
  });

  it("returns empty array when no dividends in events", async () => {
    const noEvents = {
      chart: {
        result: [
          {
            ...yahooDividendsFixture.chart.result[0],
            events: {},
          },
        ],
        error: null,
      },
    };
    mockFetch(noEvents);
    const provider = new YahooProvider();
    const events = await provider.dividends("AAPL");

    expect(events).toHaveLength(0);

    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// Yahoo — splits
// ---------------------------------------------------------------------------

describe("YahooProvider.splits()", () => {
  it("returns normalised SplitEvent array", async () => {
    mockFetch(yahooSplitsFixture);
    const provider = new YahooProvider();
    const events = await provider.splits("AAPL");

    expect(events).toHaveLength(1);
    const e = events[0]!;
    expect(e.symbol).toBe("AAPL");
    expect(e.date).toBeInstanceOf(Date);
    expect(e.ratio).toBe(4);
    expect(e.description).toBe("4:1");
    expect(e.provider).toBe("yahoo");

    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// Polygon — dividends
// ---------------------------------------------------------------------------

describe("PolygonProvider.dividends()", () => {
  it("returns normalised DividendEvent array", async () => {
    mockFetch(polygonDividendsFixture);
    const provider = new PolygonProvider({ apiKey: "test-key" });
    const events = await provider.dividends("AAPL");

    expect(events).toHaveLength(2);
    const e = events[0]!;
    expect(e.symbol).toBe("AAPL");
    expect(e.exDate).toBeInstanceOf(Date);
    expect(e.exDate.toISOString().startsWith("2024-08")).toBe(true);
    expect(e.payDate).toBeInstanceOf(Date);
    expect(e.declaredDate).toBeInstanceOf(Date);
    expect(e.amount).toBe(0.25);
    expect(e.currency).toBe("USD");
    expect(e.frequency).toBe("quarterly");
    expect(e.provider).toBe("polygon");

    vi.unstubAllGlobals();
  });

  it("returns raw response when raw:true", async () => {
    mockFetch(polygonDividendsFixture);
    const provider = new PolygonProvider({ apiKey: "test-key" });
    const events = await provider.dividends("AAPL", { raw: true });

    expect(events[0]?.raw).toBeDefined();

    vi.unstubAllGlobals();
  });

  it("maps frequency numbers correctly", async () => {
    const fixture = {
      status: "OK",
      results: [
        { ticker: "T1", ex_dividend_date: "2024-01-01", cash_amount: 1, frequency: 1 },
        { ticker: "T2", ex_dividend_date: "2024-01-01", cash_amount: 1, frequency: 2 },
        { ticker: "T3", ex_dividend_date: "2024-01-01", cash_amount: 1, frequency: 12 },
        { ticker: "T4", ex_dividend_date: "2024-01-01", cash_amount: 1, frequency: 99 },
        { ticker: "T5", ex_dividend_date: "2024-01-01", cash_amount: 1 },
      ],
    };
    mockFetch(fixture);
    const provider = new PolygonProvider({ apiKey: "key" });
    const events = await provider.dividends("T");

    expect(events[0]?.frequency).toBe("annual");
    expect(events[1]?.frequency).toBe("semi-annual");
    expect(events[2]?.frequency).toBe("monthly");
    expect(events[3]?.frequency).toBe("irregular");
    expect(events[4]?.frequency).toBeUndefined();

    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// Polygon — splits
// ---------------------------------------------------------------------------

describe("PolygonProvider.splits()", () => {
  it("returns normalised SplitEvent array", async () => {
    mockFetch(polygonSplitsFixture);
    const provider = new PolygonProvider({ apiKey: "test-key" });
    const events = await provider.splits("AAPL");

    expect(events).toHaveLength(2);
    const e = events[0]!;
    expect(e.symbol).toBe("AAPL");
    expect(e.date.toISOString().startsWith("2020-08-31")).toBe(true);
    expect(e.ratio).toBe(4); // split_to / split_from = 4 / 1
    expect(e.description).toBe("4:1");
    expect(e.provider).toBe("polygon");

    vi.unstubAllGlobals();
  });

  it("computes ratio as split_to / split_from", async () => {
    mockFetch({
      status: "OK",
      results: [{ ticker: "TSLA", execution_date: "2022-08-25", split_from: 1, split_to: 3 }],
    });
    const provider = new PolygonProvider({ apiKey: "key" });
    const events = await provider.splits("TSLA");

    expect(events[0]?.ratio).toBe(3);

    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// Finnhub — earnings
// ---------------------------------------------------------------------------

describe("FinnhubProvider.earnings()", () => {
  it("returns normalised EarningsEvent array", async () => {
    mockFetch(finnhubEarningsFixture);
    const provider = new FinnhubProvider({ apiKey: "test-key" });
    const events = await provider.earnings("AAPL");

    expect(events).toHaveLength(3);
    const e = events[0]!;
    expect(e.symbol).toBe("AAPL");
    expect(e.date).toBeInstanceOf(Date);
    expect(e.date.getFullYear()).toBe(2024);
    expect(e.epsActual).toBe(1.53);
    expect(e.epsEstimate).toBe(1.5);
    expect(e.epsSurprisePct).toBe(2.0);
    expect(e.provider).toBe("finnhub");

    vi.unstubAllGlobals();
  });

  it("handles null actual/estimate gracefully", async () => {
    mockFetch([
      {
        actual: null,
        estimate: null,
        period: "2024-06-30",
        quarter: 3,
        surprise: null,
        surprisePercent: null,
        symbol: "AAPL",
        year: 2024,
      },
    ]);
    const provider = new FinnhubProvider({ apiKey: "key" });
    const events = await provider.earnings("AAPL");

    expect(events[0]?.epsActual).toBeUndefined();
    expect(events[0]?.epsEstimate).toBeUndefined();
    expect(events[0]?.epsSurprisePct).toBeUndefined();

    vi.unstubAllGlobals();
  });

  it("includes raw response when raw:true", async () => {
    mockFetch(finnhubEarningsFixture);
    const provider = new FinnhubProvider({ apiKey: "key" });
    const events = await provider.earnings("AAPL", { raw: true });

    expect(events[0]?.raw).toBeDefined();

    vi.unstubAllGlobals();
  });

  it("throws ProviderError when response is not an array", async () => {
    mockFetch({ error: "unexpected" });
    const provider = new FinnhubProvider({ apiKey: "key" });

    await expect(provider.earnings("AAPL")).rejects.toThrow(ProviderError);

    vi.unstubAllGlobals();
  });
});
