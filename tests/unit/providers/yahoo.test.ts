import { describe, expect, it, vi } from "vitest";
import { ProviderError } from "../../../src/errors.js";
import { YahooProvider } from "../../../src/providers/yahoo/index.js";
import yahooQuoteFixture from "../../fixtures/yahoo-quote.json";

function mockFetch(fixture: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status,
      statusText: ok ? "OK" : "Not Found",
      headers: { get: () => "application/json" },
      json: async () => fixture,
    }),
  );
}

describe("YahooProvider", () => {
  describe("quote()", () => {
    it("returns a normalised Quote for a single symbol", async () => {
      mockFetch(yahooQuoteFixture);
      const provider = new YahooProvider();
      const [quote] = await provider.quote(["AAPL"]);

      expect(quote?.symbol).toBe("AAPL");
      expect(quote?.price).toBe(189.84);
      expect(quote?.currency).toBe("USD");
      expect(quote?.exchange).toBe("NasdaqGS");
      expect(quote?.provider).toBe("yahoo");
      expect(quote?.timestamp).toBeInstanceOf(Date);
      expect(quote?.timestamp.getFullYear()).toBe(2024);

      vi.unstubAllGlobals();
    });

    it("calculates change and changePercent correctly", async () => {
      mockFetch(yahooQuoteFixture);
      const provider = new YahooProvider();
      const [quote] = await provider.quote(["AAPL"]);

      // price 189.84, prevClose 188.32
      expect(quote?.change).toBeCloseTo(1.52, 2);
      expect(quote?.changePercent).toBeCloseTo(0.807, 2);

      vi.unstubAllGlobals();
    });

    it("returns 52-week high and low when present", async () => {
      mockFetch(yahooQuoteFixture);
      const provider = new YahooProvider();
      const [quote] = await provider.quote(["AAPL"]);

      expect(quote?.fiftyTwoWeekHigh).toBe(199.62);
      expect(quote?.fiftyTwoWeekLow).toBe(124.17);

      vi.unstubAllGlobals();
    });

    it("fetches multiple symbols — one HTTP call per symbol", async () => {
      mockFetch(yahooQuoteFixture);
      const provider = new YahooProvider();
      const quotes = await provider.quote(["AAPL", "MSFT", "GOOGL"]);

      expect(quotes).toHaveLength(3);
      // fetch should have been called 3 times (one per symbol)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((global as any).fetch).toHaveBeenCalledTimes(3);

      vi.unstubAllGlobals();
    });

    it("includes raw response when raw:true", async () => {
      mockFetch(yahooQuoteFixture);
      const provider = new YahooProvider();
      const [quote] = await provider.quote(["AAPL"], { raw: true });
      expect(quote?.raw).toBeDefined();
      expect(quote?.raw).toHaveProperty("chart");

      vi.unstubAllGlobals();
    });

    it("raw is absent when raw option not set", async () => {
      mockFetch(yahooQuoteFixture);
      const provider = new YahooProvider();
      const [quote] = await provider.quote(["AAPL"]);
      expect(quote?.raw).toBeUndefined();

      vi.unstubAllGlobals();
    });

    it("throws ProviderError when chart result is null", async () => {
      mockFetch({
        chart: { result: null, error: { code: "Not Found", description: "No data for symbol" } },
      });
      const provider = new YahooProvider();
      await expect(provider.quote(["INVALID"])).rejects.toThrow(ProviderError);

      vi.unstubAllGlobals();
    });

    it("throws ProviderError on HTTP 404", async () => {
      mockFetch({}, false, 404);
      const provider = new YahooProvider();
      await expect(provider.quote(["AAPL"])).rejects.toThrow(ProviderError);

      vi.unstubAllGlobals();
    });

    it("throws ProviderError when chart result is empty array", async () => {
      mockFetch({ chart: { result: [], error: null } });
      const provider = new YahooProvider();
      await expect(provider.quote(["AAPL"])).rejects.toThrow(ProviderError);

      vi.unstubAllGlobals();
    });
  });

  describe("historical()", () => {
    it("returns sorted HistoricalBar array with adjClose", async () => {
      const fixture = {
        chart: {
          result: [
            {
              meta: { ...yahooQuoteFixture.chart.result?.[0]?.meta },
              timestamp: [1704067200, 1704153600, 1704240000],
              indicators: {
                quote: [
                  {
                    open: [185.0, 186.0, 187.0],
                    high: [186.5, 187.5, 188.5],
                    low: [184.0, 185.0, 186.0],
                    close: [186.0, 187.0, 188.0],
                    volume: [40000000, 42000000, 38000000],
                  },
                ],
                adjclose: [{ adjclose: [185.9, 186.9, 187.9] }],
              },
            },
          ],
          error: null,
        },
      };

      mockFetch(fixture);
      const provider = new YahooProvider();
      const bars = await provider.historical("AAPL");

      expect(bars).toHaveLength(3);
      expect(bars[0]?.date).toBeInstanceOf(Date);
      expect(bars[0]?.open).toBe(185.0);
      expect(bars[0]?.high).toBe(186.5);
      expect(bars[0]?.low).toBe(184.0);
      expect(bars[0]?.close).toBe(186.0);
      expect(bars[0]?.adjClose).toBe(185.9);
      expect(bars[0]?.volume).toBe(40000000);

      vi.unstubAllGlobals();
    });

    it("filters out null bars (non-trading days)", async () => {
      const fixture = {
        chart: {
          result: [
            {
              meta: { ...yahooQuoteFixture.chart.result?.[0]?.meta },
              timestamp: [1704067200, 1704153600, 1704240000],
              indicators: {
                quote: [
                  {
                    open: [185.0, null, 187.0],
                    high: [186.5, null, 188.5],
                    low: [184.0, null, 186.0],
                    close: [186.0, null, 188.0],
                    volume: [40000000, null, 38000000],
                  },
                ],
              },
            },
          ],
          error: null,
        },
      };

      mockFetch(fixture);
      const provider = new YahooProvider();
      const bars = await provider.historical("AAPL");

      expect(bars).toHaveLength(2);
      expect(bars[0]?.close).toBe(186.0);
      expect(bars[1]?.close).toBe(188.0);

      vi.unstubAllGlobals();
    });

    it("returns empty array when no timestamps", async () => {
      const fixture = {
        chart: {
          result: [
            {
              meta: { ...yahooQuoteFixture.chart.result?.[0]?.meta },
              indicators: { quote: [{ open: [], high: [], low: [], close: [], volume: [] }] },
            },
          ],
          error: null,
        },
      };

      mockFetch(fixture);
      const provider = new YahooProvider();
      const bars = await provider.historical("AAPL");
      expect(bars).toHaveLength(0);

      vi.unstubAllGlobals();
    });

    it("passes interval to request params", async () => {
      let capturedUrl = "";
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(async (url: string) => {
          capturedUrl = url;
          return {
            ok: true,
            headers: { get: () => "application/json" },
            json: async () => yahooQuoteFixture,
          };
        }),
      );

      const provider = new YahooProvider();
      // Will throw because fixture doesn't have proper historical data, but we check URL
      try {
        await provider.historical("AAPL", { interval: "1wk" });
      } catch {
        // expected
      }

      expect(capturedUrl).toContain("interval=1wk");
      vi.unstubAllGlobals();
    });

    it("throws ProviderError when result is null", async () => {
      mockFetch({ chart: { result: null, error: { code: "No Data", description: "No data" } } });
      const provider = new YahooProvider();
      await expect(provider.historical("INVALID")).rejects.toThrow(ProviderError);
      vi.unstubAllGlobals();
    });
  });

  describe("search()", () => {
    it("maps EQUITY quoteType to stock", async () => {
      mockFetch({
        quotes: [
          { symbol: "AAPL", longname: "Apple Inc.", quoteType: "EQUITY", exchDisp: "NASDAQ" },
        ],
      });
      const provider = new YahooProvider();
      const [result] = await provider.search("Apple");
      expect(result?.type).toBe("stock");
      vi.unstubAllGlobals();
    });

    it("maps ETF quoteType to etf", async () => {
      mockFetch({ quotes: [{ symbol: "SPY", shortname: "SPDR S&P 500", quoteType: "ETF" }] });
      const provider = new YahooProvider();
      const [result] = await provider.search("SPY");
      expect(result?.type).toBe("etf");
      vi.unstubAllGlobals();
    });

    it("maps CRYPTOCURRENCY to crypto", async () => {
      mockFetch({
        quotes: [{ symbol: "BTC-USD", longname: "Bitcoin USD", quoteType: "CRYPTOCURRENCY" }],
      });
      const provider = new YahooProvider();
      const [result] = await provider.search("bitcoin");
      expect(result?.type).toBe("crypto");
      vi.unstubAllGlobals();
    });

    it("returns unknown for unrecognised quoteType", async () => {
      mockFetch({ quotes: [{ symbol: "WEIRD", longname: "Weird Asset", quoteType: "NEWTYPE" }] });
      const provider = new YahooProvider();
      const [result] = await provider.search("weird");
      expect(result?.type).toBe("unknown");
      vi.unstubAllGlobals();
    });

    it("respects the limit option", async () => {
      mockFetch({
        quotes: Array.from({ length: 20 }, (_, i) => ({
          symbol: `SYM${i}`,
          shortname: `Symbol ${i}`,
          quoteType: "EQUITY",
        })),
      });
      const provider = new YahooProvider();
      const results = await provider.search("sym", { limit: 5 });
      expect(results).toHaveLength(5);
      vi.unstubAllGlobals();
    });

    it("returns empty array when no quotes in response", async () => {
      mockFetch({ quotes: [] });
      const provider = new YahooProvider();
      const results = await provider.search("xyznotreal");
      expect(results).toEqual([]);
      vi.unstubAllGlobals();
    });
  });

  describe("company()", () => {
    it("returns CompanyProfile with all fields", async () => {
      const fixture = {
        quoteSummary: {
          result: [
            {
              assetProfile: {
                longBusinessSummary: "Apple Inc. designs and manufactures...",
                sector: "Technology",
                industry: "Consumer Electronics",
                country: "United States",
                fullTimeEmployees: 164000,
                website: "https://www.apple.com",
                companyOfficers: [
                  { name: "Timothy Cook", title: "Chief Executive Officer" },
                  { name: "Luca Maestri", title: "Senior Vice President, Chief Financial Officer" },
                ],
              },
              summaryDetail: {
                currency: "USD",
                marketCap: { raw: 2900000000000 },
                trailingPE: { raw: 29.5 },
                forwardPE: { raw: 26.2 },
                priceToBook: { raw: 45.3 },
                dividendYield: { raw: 0.0055 },
                beta: { raw: 1.24 },
              },
              price: {
                longName: "Apple Inc.",
                exchangeName: "NasdaqGS",
                currency: "USD",
              },
            },
          ],
          error: null,
        },
      };

      mockFetch(fixture);
      const provider = new YahooProvider();
      const profile = await provider.company("AAPL");

      expect(profile.symbol).toBe("AAPL");
      expect(profile.name).toBe("Apple Inc.");
      expect(profile.sector).toBe("Technology");
      expect(profile.industry).toBe("Consumer Electronics");
      expect(profile.country).toBe("United States");
      expect(profile.employees).toBe(164000);
      expect(profile.website).toBe("https://www.apple.com");
      expect(profile.ceo).toBe("Timothy Cook");
      expect(profile.marketCap).toBe(2900000000000);
      expect(profile.peRatio).toBe(29.5);
      expect(profile.forwardPE).toBe(26.2);
      expect(profile.priceToBook).toBe(45.3);
      expect(profile.dividendYield).toBe(0.0055);
      expect(profile.beta).toBe(1.24);
      expect(profile.exchange).toBe("NasdaqGS");
      expect(profile.provider).toBe("yahoo");

      vi.unstubAllGlobals();
    });

    it("falls back to symbol as name when price module absent", async () => {
      const fixture = {
        quoteSummary: {
          result: [{ assetProfile: {}, summaryDetail: {}, price: {} }],
          error: null,
        },
      };

      mockFetch(fixture);
      const provider = new YahooProvider();
      const profile = await provider.company("AAPL");
      expect(profile.name).toBe("AAPL");

      vi.unstubAllGlobals();
    });

    it("throws ProviderError when quoteSummary result is null", async () => {
      mockFetch({
        quoteSummary: {
          result: null,
          error: { code: "Not Found", description: "No company data" },
        },
      });
      const provider = new YahooProvider();
      await expect(provider.company("INVALID")).rejects.toThrow(ProviderError);
      vi.unstubAllGlobals();
    });
  });
});
