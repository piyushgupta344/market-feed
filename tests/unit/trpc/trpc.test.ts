import { describe, expect, it, vi } from "vitest";
import { createHttpHandler, createMarketFeedRouter } from "../../../src/trpc/index.js";
import type { CompanyProfile } from "../../../src/types/company.js";
import type { HistoricalBar } from "../../../src/types/historical.js";
import type { NewsItem } from "../../../src/types/news.js";
import type { Quote } from "../../../src/types/quote.js";
import type { SearchResult } from "../../../src/types/search.js";

// ---------------------------------------------------------------------------
// Minimal feed mock
// ---------------------------------------------------------------------------

function makeQuote(symbol = "AAPL"): Quote {
  return {
    symbol,
    name: `${symbol} Inc.`,
    price: 190,
    change: 1,
    changePercent: 0.5,
    open: 189,
    high: 191,
    low: 188,
    close: 190,
    previousClose: 189,
    volume: 50_000_000,
    currency: "USD",
    exchange: "NASDAQ",
    timestamp: new Date("2026-03-12T15:00:00Z"),
    provider: "test",
  };
}

function makeBar(date = "2026-03-11"): HistoricalBar {
  return {
    date: new Date(date),
    open: 188,
    high: 191,
    low: 187,
    close: 190,
    volume: 50_000_000,
  };
}

function makeSearchResult(): SearchResult {
  return {
    symbol: "AAPL",
    name: "Apple Inc.",
    exchange: "NASDAQ",
    type: "stock",
    provider: "test",
  };
}

function makeCompany(): CompanyProfile {
  return {
    symbol: "AAPL",
    name: "Apple Inc.",
    description: "Makes iPhones.",
    sector: "Technology",
    industry: "Consumer Electronics",
    country: "United States",
    exchange: "NASDAQ",
    currency: "USD",
    website: "https://apple.com",
    provider: "test",
  };
}

function makeNews(): NewsItem {
  return {
    id: "news-1",
    title: "AAPL beats estimates",
    summary: "Apple reported record earnings.",
    url: "https://example.com/news/1",
    publishedAt: new Date("2026-03-12T10:00:00Z"),
    source: "Reuters",
    symbols: ["AAPL"],
    provider: "test",
  };
}

function makeFeed() {
  return {
    quote: vi.fn().mockResolvedValue([makeQuote()]),
    historical: vi.fn().mockResolvedValue([makeBar()]),
    search: vi.fn().mockResolvedValue([makeSearchResult()]),
    company: vi.fn().mockResolvedValue(makeCompany()),
    news: vi.fn().mockResolvedValue([makeNews()]),
    earnings: vi.fn().mockResolvedValue([]),
    dividends: vi.fn().mockResolvedValue([]),
    splits: vi.fn().mockResolvedValue([]),
    incomeStatements: vi.fn().mockResolvedValue([]),
    balanceSheets: vi.fn().mockResolvedValue([]),
    cashFlows: vi.fn().mockResolvedValue([]),
    optionChain: vi
      .fn()
      .mockResolvedValue({ calls: [], puts: [], underlyingSymbol: "AAPL", fetchedAt: new Date() }),
  };
}

// ---------------------------------------------------------------------------
// createMarketFeedRouter
// ---------------------------------------------------------------------------

describe("createMarketFeedRouter", () => {
  it("quote() wraps feed.quote() and returns { quotes }", async () => {
    const feed = makeFeed();
    const router = createMarketFeedRouter(feed);

    const result = await router.quote({ symbols: ["AAPL", "MSFT"] });

    expect(feed.quote).toHaveBeenCalledWith(["AAPL", "MSFT"]);
    expect(result).toEqual({ quotes: [makeQuote()] });
  });

  it("historical() delegates to feed.historical()", async () => {
    const feed = makeFeed();
    const router = createMarketFeedRouter(feed);

    const result = await router.historical({ symbol: "AAPL" });

    expect(feed.historical).toHaveBeenCalledWith("AAPL", undefined);
    expect(result).toEqual([makeBar()]);
  });

  it("historical() passes options through", async () => {
    const feed = makeFeed();
    const router = createMarketFeedRouter(feed);
    const options = { period1: "2025-01-01", period2: "2026-01-01" };

    await router.historical({ symbol: "AAPL", options });

    expect(feed.historical).toHaveBeenCalledWith("AAPL", options);
  });

  it("search() delegates to feed.search() with limit", async () => {
    const feed = makeFeed();
    const router = createMarketFeedRouter(feed);

    const result = await router.search({ query: "apple", limit: 5 });

    expect(feed.search).toHaveBeenCalledWith("apple", { limit: 5 });
    expect(result).toEqual([makeSearchResult()]);
  });

  it("company() delegates to feed.company()", async () => {
    const feed = makeFeed();
    const router = createMarketFeedRouter(feed);

    const result = await router.company({ symbol: "AAPL" });

    expect(feed.company).toHaveBeenCalledWith("AAPL");
    expect(result.name).toBe("Apple Inc.");
  });

  it("company() throws when feed does not support company()", async () => {
    const feed = { quote: vi.fn(), historical: vi.fn(), search: vi.fn() };
    const router = createMarketFeedRouter(feed);

    await expect(router.company({ symbol: "AAPL" })).rejects.toThrow("company() is not supported");
  });

  it("news() delegates to feed.news() with limit", async () => {
    const feed = makeFeed();
    const router = createMarketFeedRouter(feed);

    await router.news({ symbol: "AAPL", limit: 10 });

    expect(feed.news).toHaveBeenCalledWith("AAPL", { limit: 10 });
  });

  it("earnings() delegates to feed.earnings()", async () => {
    const feed = makeFeed();
    const router = createMarketFeedRouter(feed);

    await router.earnings({ symbol: "AAPL" });

    expect(feed.earnings).toHaveBeenCalledWith("AAPL");
  });

  it("incomeStatements() delegates with options", async () => {
    const feed = makeFeed();
    const router = createMarketFeedRouter(feed);
    const options = { quarterly: true, limit: 4 };

    await router.incomeStatements({ symbol: "AAPL", options });

    expect(feed.incomeStatements).toHaveBeenCalledWith("AAPL", options);
  });

  it("optionChain() delegates to feed.optionChain()", async () => {
    const feed = makeFeed();
    const router = createMarketFeedRouter(feed);

    const result = await router.optionChain({ symbol: "AAPL" });

    expect(feed.optionChain).toHaveBeenCalledWith("AAPL", undefined);
    expect(result.underlyingSymbol).toBe("AAPL");
  });
});

// ---------------------------------------------------------------------------
// createHttpHandler
// ---------------------------------------------------------------------------

describe("createHttpHandler", () => {
  function makeRequest(procedure: string, body: unknown): Request {
    return new Request(`http://localhost/api/${procedure}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("responds with JSON data for a valid procedure", async () => {
    const feed = makeFeed();
    const router = createMarketFeedRouter(feed);
    const handler = createHttpHandler(router);

    const res = await handler(makeRequest("quote", { symbols: ["AAPL"] }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { quotes: Quote[] };
    expect(body.quotes[0]?.symbol).toBe("AAPL");
    expect(res.headers.get("Content-Type")).toBe("application/json");
  });

  it("returns 404 for unknown procedure", async () => {
    const feed = makeFeed();
    const router = createMarketFeedRouter(feed);
    const handler = createHttpHandler(router);

    const res = await handler(makeRequest("fooBar", {}));

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("fooBar");
  });

  it("returns 400 for malformed JSON body", async () => {
    const feed = makeFeed();
    const router = createMarketFeedRouter(feed);
    const handler = createHttpHandler(router);

    const req = new Request("http://localhost/api/quote", {
      method: "POST",
      body: "not-json",
    });
    const res = await handler(req);

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("JSON");
  });

  it("returns 500 when the procedure throws", async () => {
    const feed = makeFeed();
    feed.quote.mockRejectedValue(new Error("provider down"));
    const router = createMarketFeedRouter(feed);
    const handler = createHttpHandler(router);

    const res = await handler(makeRequest("quote", { symbols: ["AAPL"] }));

    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("provider down");
  });

  it("handles empty body as empty object", async () => {
    const feed = makeFeed();
    const router = createMarketFeedRouter(feed);
    const handler = createHttpHandler(router);

    const req = new Request("http://localhost/api/historical", { method: "POST" });
    // historical with undefined symbol will still call feed.historical
    const res = await handler(req);
    // Should not 400 (JSON error), should reach the procedure
    expect(res.status).not.toBe(400);
  });

  it("routes via the last path segment", async () => {
    const feed = makeFeed();
    const router = createMarketFeedRouter(feed);
    const handler = createHttpHandler(router);

    // Deeply nested path — still resolves to "company"
    const req = new Request("http://localhost/api/v1/market-feed/company", {
      method: "POST",
      body: JSON.stringify({ symbol: "AAPL" }),
    });
    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(feed.company).toHaveBeenCalledWith("AAPL");
  });
});
