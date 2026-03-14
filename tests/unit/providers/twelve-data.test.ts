import { describe, expect, it, vi } from "vitest";
import { ProviderError } from "../../../src/errors.js";
import { TwelveDataProvider } from "../../../src/providers/twelve-data/index.js";
import { RateLimiter } from "../../../src/utils/rate-limiter.js";
import tdProfileFixture from "../../fixtures/twelve-data-profile.json";
import tdQuoteFixture from "../../fixtures/twelve-data-quote.json";
import tdSearchFixture from "../../fixtures/twelve-data-search.json";
import tdTimeSeriesFixture from "../../fixtures/twelve-data-time-series.json";

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

const unlimitedLimiter = new RateLimiter("twelve-data", 9999, 9999);

describe("TwelveDataProvider", () => {
  // ---------------------------------------------------------------------------
  // quote()
  // ---------------------------------------------------------------------------

  describe("quote()", () => {
    it("returns a normalised Quote with all price fields", async () => {
      mockFetch(tdQuoteFixture);
      const provider = new TwelveDataProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const [quote] = await provider.quote(["AAPL"]);

      expect(quote?.symbol).toBe("AAPL");
      expect(quote?.name).toBe("Apple Inc");
      expect(quote?.price).toBeCloseTo(187.94, 2);
      expect(quote?.change).toBeCloseTo(1.08, 2);
      expect(quote?.changePercent).toBeCloseTo(0.57826, 4);
      expect(quote?.open).toBeCloseTo(180.02, 2);
      expect(quote?.high).toBeCloseTo(190.32, 2);
      expect(quote?.low).toBeCloseTo(185.19, 2);
      expect(quote?.previousClose).toBeCloseTo(186.86, 2);
      expect(quote?.volume).toBe(50123456);
      expect(quote?.currency).toBe("USD");
      expect(quote?.exchange).toBe("NASDAQ");
      expect(quote?.provider).toBe("twelve-data");

      vi.unstubAllGlobals();
    });

    it("populates avgVolume and fiftyTwoWeek fields from fixture", async () => {
      mockFetch(tdQuoteFixture);
      const provider = new TwelveDataProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const [quote] = await provider.quote(["AAPL"]);

      expect(quote?.avgVolume).toBe(55000000);
      expect(quote?.fiftyTwoWeekHigh).toBeCloseTo(199.62, 2);
      expect(quote?.fiftyTwoWeekLow).toBeCloseTo(164.08, 2);

      vi.unstubAllGlobals();
    });

    it("timestamp is a valid Date from Unix epoch", async () => {
      mockFetch(tdQuoteFixture);
      const provider = new TwelveDataProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const [quote] = await provider.quote(["AAPL"]);

      expect(quote?.timestamp).toBeInstanceOf(Date);
      expect(quote?.timestamp.getFullYear()).toBe(2024);

      vi.unstubAllGlobals();
    });

    it("throws ProviderError when API returns error code", async () => {
      mockFetch({ code: 400, message: "symbol not found: INVALID", status: "error" });
      const provider = new TwelveDataProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      await expect(provider.quote(["INVALID"])).rejects.toThrow(ProviderError);
      vi.unstubAllGlobals();
    });

    it("includes raw response when raw:true", async () => {
      mockFetch(tdQuoteFixture);
      const provider = new TwelveDataProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const [quote] = await provider.quote(["AAPL"], { raw: true });
      expect(quote?.raw).toBeDefined();
      vi.unstubAllGlobals();
    });

    it("fetches multiple symbols in parallel", async () => {
      let callCount = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(async () => {
          callCount++;
          return {
            ok: true,
            headers: { get: () => "application/json" },
            json: async () => tdQuoteFixture,
          };
        }),
      );

      const provider = new TwelveDataProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const quotes = await provider.quote(["AAPL", "MSFT", "GOOGL"]);
      expect(quotes).toHaveLength(3);
      expect(callCount).toBe(3);
      vi.unstubAllGlobals();
    });

    it("sends apikey as a query parameter", async () => {
      const captured: string[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(async (url: string) => {
          captured.push(url);
          return {
            ok: true,
            headers: { get: () => "application/json" },
            json: async () => tdQuoteFixture,
          };
        }),
      );

      const provider = new TwelveDataProvider({
        apiKey: "mykey123",
        rateLimiter: unlimitedLimiter,
      });
      await provider.quote(["AAPL"]);
      expect(captured[0]).toContain("apikey=mykey123");
      vi.unstubAllGlobals();
    });
  });

  // ---------------------------------------------------------------------------
  // historical()
  // ---------------------------------------------------------------------------

  describe("historical()", () => {
    it("returns HistoricalBar array in chronological order", async () => {
      mockFetch(tdTimeSeriesFixture);
      const provider = new TwelveDataProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const bars = await provider.historical("AAPL");

      expect(bars).toHaveLength(3);
      // Twelve Data returns newest-first; provider reverses to chronological
      expect(bars[0]?.date.toISOString().slice(0, 10)).toBe("2024-03-04");
      expect(bars[2]?.date.toISOString().slice(0, 10)).toBe("2024-03-06");
      vi.unstubAllGlobals();
    });

    it("maps all OHLCV fields correctly", async () => {
      mockFetch(tdTimeSeriesFixture);
      const provider = new TwelveDataProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const bars = await provider.historical("AAPL");

      // Last bar (newest) = 2024-03-06
      const last = bars[2]!;
      expect(last.open).toBeCloseTo(169.15001, 4);
      expect(last.high).toBeCloseTo(170.72999, 4);
      expect(last.low).toBeCloseTo(168.49001, 4);
      expect(last.close).toBeCloseTo(169.12, 2);
      expect(last.volume).toBe(68887100);
      vi.unstubAllGlobals();
    });

    it("throws ProviderError on API error response", async () => {
      mockFetch({ code: 400, status: "error", message: "symbol not found: XYZ" });
      const provider = new TwelveDataProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      await expect(provider.historical("XYZ")).rejects.toThrow(ProviderError);
      vi.unstubAllGlobals();
    });

    it("throws ProviderError when values array is empty", async () => {
      mockFetch({ meta: {}, values: [], status: "ok" });
      const provider = new TwelveDataProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      await expect(provider.historical("AAPL")).rejects.toThrow(ProviderError);
      vi.unstubAllGlobals();
    });

    it("maps interval to correct Twelve Data interval string", async () => {
      const captured: string[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(async (url: string) => {
          captured.push(url);
          return {
            ok: true,
            headers: { get: () => "application/json" },
            json: async () => tdTimeSeriesFixture,
          };
        }),
      );

      const provider = new TwelveDataProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      await provider.historical("AAPL", { interval: "1d" });
      await provider.historical("AAPL", { interval: "1wk" });
      await provider.historical("AAPL", { interval: "1mo" });
      await provider.historical("AAPL", { interval: "1h" });
      await provider.historical("AAPL", { interval: "5m" });

      expect(captured[0]).toContain("interval=1day");
      expect(captured[1]).toContain("interval=1week");
      expect(captured[2]).toContain("interval=1month");
      expect(captured[3]).toContain("interval=1h");
      expect(captured[4]).toContain("interval=5min");

      vi.unstubAllGlobals();
    });

    it("passes start_date and end_date from period1/period2", async () => {
      const captured: string[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(async (url: string) => {
          captured.push(url);
          return {
            ok: true,
            headers: { get: () => "application/json" },
            json: async () => tdTimeSeriesFixture,
          };
        }),
      );

      const provider = new TwelveDataProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      await provider.historical("AAPL", { period1: "2024-01-01", period2: "2024-12-31" });

      expect(captured[0]).toContain("start_date=2024-01-01");
      expect(captured[0]).toContain("end_date=2024-12-31");
      vi.unstubAllGlobals();
    });

    it("includes raw on each bar when raw:true", async () => {
      mockFetch(tdTimeSeriesFixture);
      const provider = new TwelveDataProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const bars = await provider.historical("AAPL", { raw: true });
      expect(bars[0]?.raw).toBeDefined();
      vi.unstubAllGlobals();
    });
  });

  // ---------------------------------------------------------------------------
  // search()
  // ---------------------------------------------------------------------------

  describe("search()", () => {
    it("returns normalised SearchResult array", async () => {
      mockFetch(tdSearchFixture);
      const provider = new TwelveDataProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const results = await provider.search("apple");

      expect(results).toHaveLength(3);
      expect(results[0]?.symbol).toBe("AAPL");
      expect(results[0]?.name).toBe("Apple Inc");
      expect(results[0]?.type).toBe("stock");
      expect(results[0]?.exchange).toBe("NASDAQ");
      expect(results[0]?.provider).toBe("twelve-data");
      vi.unstubAllGlobals();
    });

    it("respects limit option", async () => {
      mockFetch(tdSearchFixture);
      const provider = new TwelveDataProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const results = await provider.search("apple", { limit: 1 });
      expect(results).toHaveLength(1);
      vi.unstubAllGlobals();
    });

    it("returns empty array on API error", async () => {
      mockFetch({ code: 400, status: "error", message: "Bad request" });
      const provider = new TwelveDataProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const results = await provider.search("xyz");
      expect(results).toEqual([]);
      vi.unstubAllGlobals();
    });

    it("returns empty array when data is missing", async () => {
      mockFetch({ status: "ok" });
      const provider = new TwelveDataProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const results = await provider.search("xyz");
      expect(results).toEqual([]);
      vi.unstubAllGlobals();
    });

    it("maps ETF instrument type correctly", async () => {
      mockFetch({
        data: [
          {
            symbol: "SPY",
            instrument_name: "SPDR S&P 500 ETF Trust",
            exchange: "NYSE ARCA",
            mic_code: "ARCX",
            exchange_timezone: "America/New_York",
            instrument_type: "ETF",
            country: "United States",
            currency: "USD",
          },
        ],
        status: "ok",
      });

      const provider = new TwelveDataProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const [result] = await provider.search("SPY");
      expect(result?.type).toBe("etf");
      vi.unstubAllGlobals();
    });

    it("maps Cryptocurrency instrument type correctly", async () => {
      mockFetch({
        data: [
          {
            symbol: "BTC/USD",
            instrument_name: "Bitcoin",
            exchange: "Huobi",
            mic_code: "",
            exchange_timezone: "UTC",
            instrument_type: "Cryptocurrency",
            country: "",
            currency: "USD",
          },
        ],
        status: "ok",
      });

      const provider = new TwelveDataProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const [result] = await provider.search("BTC");
      expect(result?.type).toBe("crypto");
      vi.unstubAllGlobals();
    });
  });

  // ---------------------------------------------------------------------------
  // company()
  // ---------------------------------------------------------------------------

  describe("company()", () => {
    it("returns CompanyProfile with all available fields", async () => {
      mockFetch(tdProfileFixture);
      const provider = new TwelveDataProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const profile = await provider.company("AAPL");

      expect(profile.symbol).toBe("AAPL");
      expect(profile.name).toBe("Apple Inc");
      expect(profile.sector).toBe("Technology");
      expect(profile.industry).toBe("Consumer Electronics");
      expect(profile.country).toBe("United States");
      expect(profile.employees).toBe(154000);
      expect(profile.website).toBe("https://www.apple.com");
      expect(profile.description).toContain("Apple Inc.");
      expect(profile.ceo).toBe("Tim Cook");
      expect(profile.exchange).toBe("NASDAQ");
      expect(profile.provider).toBe("twelve-data");
      vi.unstubAllGlobals();
    });

    it("throws ProviderError when API returns error code", async () => {
      mockFetch({ code: 400, message: "symbol not found: INVALID", status: "error" });
      const provider = new TwelveDataProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      await expect(provider.company("INVALID")).rejects.toThrow(ProviderError);
      vi.unstubAllGlobals();
    });

    it("throws ProviderError when name is empty", async () => {
      mockFetch({ symbol: "XYZ", name: "", exchange: "NASDAQ" });
      const provider = new TwelveDataProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      await expect(provider.company("XYZ")).rejects.toThrow(ProviderError);
      vi.unstubAllGlobals();
    });

    it("includes raw response when raw:true", async () => {
      mockFetch(tdProfileFixture);
      const provider = new TwelveDataProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const profile = await provider.company("AAPL", { raw: true });
      expect(profile.raw).toBeDefined();
      vi.unstubAllGlobals();
    });
  });
});
