import { describe, expect, it, vi } from "vitest";
import { ProviderError, RateLimitError } from "../../../src/errors.js";
import { AlphaVantageProvider } from "../../../src/providers/alpha-vantage/index.js";
import { RateLimiter } from "../../../src/utils/rate-limiter.js";
import avQuoteFixture from "../../fixtures/alpha-vantage-quote.json";

function mockFetch(fixture: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => fixture,
    }),
  );
}

const unlimitedLimiter = new RateLimiter("alpha-vantage", 9999, 9999);

describe("AlphaVantageProvider", () => {
  describe("quote()", () => {
    it("returns a normalised Quote with correct price fields", async () => {
      mockFetch(avQuoteFixture);
      const provider = new AlphaVantageProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const [quote] = await provider.quote(["AAPL"]);

      expect(quote?.symbol).toBe("AAPL");
      expect(quote?.price).toBe(189.84);
      expect(quote?.open).toBe(188.5);
      expect(quote?.high).toBe(190.32);
      expect(quote?.low).toBe(188.19);
      expect(quote?.previousClose).toBe(188.32);
      expect(quote?.volume).toBe(52279800);
      expect(quote?.change).toBeCloseTo(1.52, 2);
      expect(quote?.changePercent).toBeCloseTo(0.8072, 2);
      expect(quote?.currency).toBe("USD");
      expect(quote?.provider).toBe("alpha-vantage");

      vi.unstubAllGlobals();
    });

    it("timestamp reflects the latest trading day", async () => {
      mockFetch(avQuoteFixture);
      const provider = new AlphaVantageProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const [quote] = await provider.quote(["AAPL"]);

      expect(quote?.timestamp).toBeInstanceOf(Date);
      // The fixture trading day is "2024-03-06" — check year and month only
      // to stay timezone-agnostic (market-close time shifts the UTC date at edges)
      expect(quote?.timestamp.getFullYear()).toBe(2024);
      expect(quote?.timestamp.getMonth()).toBe(2); // March = 2 (0-indexed)

      vi.unstubAllGlobals();
    });

    it("batches multiple symbols sequentially", async () => {
      let callCount = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(async () => {
          callCount++;
          return {
            ok: true,
            headers: { get: () => "application/json" },
            json: async () => avQuoteFixture,
          };
        }),
      );

      const provider = new AlphaVantageProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const quotes = await provider.quote(["AAPL", "MSFT"]);

      expect(quotes).toHaveLength(2);
      expect(callCount).toBe(2); // one call per symbol

      vi.unstubAllGlobals();
    });

    it("throws RateLimitError on Information message", async () => {
      mockFetch({
        Information:
          "Thank you for using Alpha Vantage! Our standard API rate limit is 25 requests per day.",
      });
      const provider = new AlphaVantageProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      await expect(provider.quote(["AAPL"])).rejects.toThrow(RateLimitError);
      vi.unstubAllGlobals();
    });

    it("throws RateLimitError on Note message", async () => {
      mockFetch({
        Note: "Thank you for using Alpha Vantage! Our standard API call frequency is 5 calls per minute.",
      });
      const provider = new AlphaVantageProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      await expect(provider.quote(["AAPL"])).rejects.toThrow(RateLimitError);
      vi.unstubAllGlobals();
    });

    it("throws ProviderError when Global Quote key is missing", async () => {
      mockFetch({});
      const provider = new AlphaVantageProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      await expect(provider.quote(["INVALID"])).rejects.toThrow(ProviderError);
      vi.unstubAllGlobals();
    });

    it("throws ProviderError when Global Quote has empty symbol", async () => {
      mockFetch({ "Global Quote": {} });
      const provider = new AlphaVantageProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      await expect(provider.quote(["INVALID"])).rejects.toThrow(ProviderError);
      vi.unstubAllGlobals();
    });
  });

  describe("historical()", () => {
    it("returns sorted bars within the date range", async () => {
      mockFetch({
        "Meta Data": {
          "1. Information": "Daily Adjusted",
          "2. Symbol": "AAPL",
          "3. Last Refreshed": "2024-03-06",
          "4. Output Size": "Full",
          "5. Time Zone": "US/Eastern",
        },
        "Time Series (Daily Adjusted)": {
          "2024-03-06": {
            "1. open": "188.5",
            "2. high": "190.32",
            "3. low": "188.19",
            "4. close": "189.84",
            "5. adjusted close": "189.84",
            "6. volume": "52279800",
            "7. dividend amount": "0.0000",
            "8. split coefficient": "1.0",
          },
          "2024-03-05": {
            "1. open": "187.0",
            "2. high": "188.5",
            "3. low": "186.5",
            "4. close": "187.9",
            "5. adjusted close": "187.9",
            "6. volume": "48000000",
            "7. dividend amount": "0.0000",
            "8. split coefficient": "1.0",
          },
          "2024-01-01": {
            "1. open": "180.0",
            "2. high": "181.0",
            "3. low": "179.0",
            "4. close": "180.5",
            "5. adjusted close": "180.5",
            "6. volume": "30000000",
            "7. dividend amount": "0.0000",
            "8. split coefficient": "1.0",
          },
        },
      });

      const provider = new AlphaVantageProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const bars = await provider.historical("AAPL", {
        period1: "2024-03-01",
        period2: "2024-03-31",
      });

      expect(bars).toHaveLength(2);
      // Should be sorted ascending
      expect(bars[0]?.date.getDate()).toBe(5);
      expect(bars[1]?.date.getDate()).toBe(6);
      // Jan 1 should be filtered out
      expect(bars.some((b) => b.date.getFullYear() === 2024 && b.date.getMonth() === 0)).toBe(
        false,
      );

      vi.unstubAllGlobals();
    });

    it("parses OHLCV values correctly", async () => {
      // Use a date within the last year so default period filter keeps it
      const recentDate = new Date();
      recentDate.setMonth(recentDate.getMonth() - 1);
      const dateStr = recentDate.toISOString().slice(0, 10);

      mockFetch({
        "Time Series (Daily Adjusted)": {
          [dateStr]: {
            "1. open": "188.5000",
            "2. high": "190.3200",
            "3. low": "188.1900",
            "4. close": "189.8400",
            "5. adjusted close": "189.7500",
            "6. volume": "52279800",
            "7. dividend amount": "0.0000",
            "8. split coefficient": "1.0",
          },
        },
      });

      const provider = new AlphaVantageProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const bars = await provider.historical("AAPL");

      expect(bars[0]?.open).toBe(188.5);
      expect(bars[0]?.high).toBe(190.32);
      expect(bars[0]?.low).toBe(188.19);
      expect(bars[0]?.close).toBe(189.84);
      expect(bars[0]?.adjClose).toBe(189.75);
      expect(bars[0]?.volume).toBe(52279800);

      vi.unstubAllGlobals();
    });

    it("throws ProviderError when time series data is missing", async () => {
      mockFetch({ "Meta Data": {} });
      const provider = new AlphaVantageProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      await expect(provider.historical("INVALID")).rejects.toThrow(ProviderError);
      vi.unstubAllGlobals();
    });
  });

  describe("search()", () => {
    it("returns normalised SearchResults", async () => {
      mockFetch({
        bestMatches: [
          {
            "1. symbol": "AAPL",
            "2. name": "Apple Inc.",
            "3. type": "Equity",
            "4. region": "United States",
            "5. marketOpen": "09:30",
            "6. marketClose": "16:00",
            "7. timezone": "UTC-05",
            "8. currency": "USD",
            "9. matchScore": "1.0000",
          },
          {
            "1. symbol": "AAPL.TRT",
            "2. name": "Apple Inc.",
            "3. type": "Equity",
            "4. region": "Toronto",
            "5. marketOpen": "09:30",
            "6. marketClose": "16:00",
            "7. timezone": "UTC-05",
            "8. currency": "CAD",
            "9. matchScore": "0.8571",
          },
        ],
      });

      const provider = new AlphaVantageProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const results = await provider.search("Apple");

      expect(results).toHaveLength(2);
      expect(results[0]?.symbol).toBe("AAPL");
      expect(results[0]?.name).toBe("Apple Inc.");
      expect(results[0]?.type).toBe("stock");
      expect(results[0]?.currency).toBe("USD");
      expect(results[0]?.provider).toBe("alpha-vantage");

      vi.unstubAllGlobals();
    });

    it("maps ETF type correctly", async () => {
      mockFetch({
        bestMatches: [
          {
            "1. symbol": "SPY",
            "2. name": "SPDR S&P 500 ETF Trust",
            "3. type": "ETF",
            "4. region": "United States",
            "5. marketOpen": "09:30",
            "6. marketClose": "16:00",
            "7. timezone": "UTC-05",
            "8. currency": "USD",
            "9. matchScore": "1.0000",
          },
        ],
      });

      const provider = new AlphaVantageProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const [result] = await provider.search("SPY");
      expect(result?.type).toBe("etf");

      vi.unstubAllGlobals();
    });

    it("respects the limit option", async () => {
      mockFetch({
        bestMatches: Array.from({ length: 10 }, (_, i) => ({
          "1. symbol": `SYM${i}`,
          "2. name": `Symbol ${i}`,
          "3. type": "Equity",
          "4. region": "US",
          "5. marketOpen": "09:30",
          "6. marketClose": "16:00",
          "7. timezone": "UTC-05",
          "8. currency": "USD",
          "9. matchScore": "1.0000",
        })),
      });

      const provider = new AlphaVantageProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const results = await provider.search("sym", { limit: 3 });
      expect(results).toHaveLength(3);

      vi.unstubAllGlobals();
    });
  });

  describe("company()", () => {
    it("returns CompanyProfile with all available fields", async () => {
      mockFetch({
        Symbol: "AAPL",
        Name: "Apple Inc.",
        Description: "Apple Inc. designs, manufactures...",
        Exchange: "NASDAQ",
        Currency: "USD",
        Country: "USA",
        Sector: "TECHNOLOGY",
        Industry: "Electronic Computers",
        FullTimeEmployees: "164000",
        OfficialSite: "https://www.apple.com",
        MarketCapitalization: "2900000000000",
        TrailingPE: "29.45",
        ForwardPE: "26.2",
        PriceToBookRatio: "45.32",
        DividendYield: "0.0055",
        Beta: "1.24",
        IPODate: "1980-12-12",
      });

      const provider = new AlphaVantageProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const profile = await provider.company("AAPL");

      expect(profile.symbol).toBe("AAPL");
      expect(profile.name).toBe("Apple Inc.");
      expect(profile.description).toContain("Apple Inc.");
      expect(profile.sector).toBe("TECHNOLOGY");
      expect(profile.industry).toBe("Electronic Computers");
      expect(profile.country).toBe("USA");
      expect(profile.employees).toBe(164000);
      expect(profile.website).toBe("https://www.apple.com");
      expect(profile.marketCap).toBe(2900000000000);
      expect(profile.peRatio).toBeCloseTo(29.45, 2);
      expect(profile.dividendYield).toBeCloseTo(0.0055, 4);
      expect(profile.ipoDate).toBeInstanceOf(Date);
      expect(profile.provider).toBe("alpha-vantage");

      vi.unstubAllGlobals();
    });

    it("throws ProviderError when Symbol field is missing", async () => {
      mockFetch({ Name: "Unknown", Exchange: "NYSE" });
      const provider = new AlphaVantageProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      await expect(provider.company("INVALID")).rejects.toThrow(ProviderError);
      vi.unstubAllGlobals();
    });
  });
});
