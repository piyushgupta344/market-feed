import { describe, expect, it, vi } from "vitest";
import { MarketFeed } from "../../src/client.js";
import type { MarketProvider } from "../../src/types/provider.js";
import type { Quote } from "../../src/types/quote.js";
import {
  AllProvidersFailedError,
  ProviderError,
  UnsupportedOperationError,
} from "../../src/errors.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    symbol: "AAPL",
    name: "Apple Inc.",
    price: 189.84,
    change: 1.52,
    changePercent: 0.81,
    open: 188.5,
    high: 190.32,
    low: 188.19,
    close: 189.84,
    previousClose: 188.32,
    volume: 52279800,
    currency: "USD",
    exchange: "NASDAQ",
    timestamp: new Date("2024-03-06T21:00:01Z"),
    provider: "mock",
    ...overrides,
  };
}

function makeProvider(overrides: Partial<MarketProvider> = {}): MarketProvider {
  return {
    name: "mock",
    quote: vi.fn().mockResolvedValue([makeQuote()]),
    historical: vi.fn().mockResolvedValue([]),
    search: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MarketFeed", () => {
  describe("quote()", () => {
    it("returns a single Quote when passed a string", async () => {
      const provider = makeProvider();
      const feed = new MarketFeed({ providers: [provider], cache: false });

      const quote = await feed.quote("AAPL");
      expect(quote.symbol).toBe("AAPL");
      expect(quote.price).toBe(189.84);
    });

    it("returns an array when passed string[]", async () => {
      const provider = makeProvider({
        quote: vi.fn().mockResolvedValue([makeQuote(), makeQuote({ symbol: "MSFT" })]),
      });
      const feed = new MarketFeed({ providers: [provider], cache: false });

      const quotes = await feed.quote(["AAPL", "MSFT"]);
      expect(quotes).toHaveLength(2);
    });

    it("serves from cache on second call", async () => {
      const provider = makeProvider();
      const feed = new MarketFeed({ providers: [provider] });

      await feed.quote("AAPL");
      await feed.quote("AAPL");

      expect(provider.quote).toHaveBeenCalledTimes(1);
    });

    it("skips cache when cache: false", async () => {
      const provider = makeProvider();
      const feed = new MarketFeed({ providers: [provider], cache: false });

      await feed.quote("AAPL");
      await feed.quote("AAPL");

      expect(provider.quote).toHaveBeenCalledTimes(2);
    });
  });

  describe("fallback behaviour", () => {
    it("falls through to second provider when first fails", async () => {
      const p1 = makeProvider({
        name: "failing",
        quote: vi.fn().mockRejectedValue(new ProviderError("Timeout", "failing")),
      });
      const p2 = makeProvider({ name: "backup" });

      const feed = new MarketFeed({ providers: [p1, p2], cache: false, fallback: true });
      const quote = await feed.quote("AAPL");

      expect(quote.provider).toBe("mock"); // p2 result
      expect(p1.quote).toHaveBeenCalledTimes(1);
      expect(p2.quote).toHaveBeenCalledTimes(1);
    });

    it("throws AllProvidersFailedError when all providers fail", async () => {
      const p1 = makeProvider({
        name: "p1",
        quote: vi.fn().mockRejectedValue(new ProviderError("Down", "p1")),
      });
      const p2 = makeProvider({
        name: "p2",
        quote: vi.fn().mockRejectedValue(new ProviderError("Down", "p2")),
      });

      const feed = new MarketFeed({ providers: [p1, p2], cache: false, fallback: true });
      await expect(feed.quote("AAPL")).rejects.toThrow(AllProvidersFailedError);
    });

    it("throws immediately when fallback: false", async () => {
      const p1 = makeProvider({
        name: "p1",
        quote: vi.fn().mockRejectedValue(new ProviderError("Down", "p1")),
      });
      const p2 = makeProvider({ name: "p2" });

      const feed = new MarketFeed({ providers: [p1, p2], cache: false, fallback: false });
      await expect(feed.quote("AAPL")).rejects.toThrow(ProviderError);
      expect(p2.quote).not.toHaveBeenCalled();
    });
  });

  describe("company()", () => {
    it("throws UnsupportedOperationError when no provider has .company()", async () => {
      const provider = makeProvider(); // no company method
      const feed = new MarketFeed({ providers: [provider], cache: false });
      await expect(feed.company("AAPL")).rejects.toThrow(AllProvidersFailedError);
    });

    it("returns CompanyProfile from provider that supports it", async () => {
      const provider = makeProvider({
        company: vi.fn().mockResolvedValue({
          symbol: "AAPL",
          name: "Apple Inc.",
          sector: "Technology",
          provider: "mock",
        }),
      });
      const feed = new MarketFeed({ providers: [provider], cache: false });
      const profile = await feed.company("AAPL");
      expect(profile.symbol).toBe("AAPL");
      expect(profile.sector).toBe("Technology");
    });
  });

  describe("clearCache()", () => {
    it("clears cached entries so next call hits provider", async () => {
      const provider = makeProvider();
      const feed = new MarketFeed({ providers: [provider] });

      await feed.quote("AAPL"); // populates cache
      await feed.clearCache();
      await feed.quote("AAPL"); // should call provider again

      expect(provider.quote).toHaveBeenCalledTimes(2);
    });
  });
});
