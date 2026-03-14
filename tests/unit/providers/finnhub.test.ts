import { describe, expect, it, vi } from "vitest";
import { ProviderError } from "../../../src/errors.js";
import { FinnhubProvider } from "../../../src/providers/finnhub/index.js";
import { RateLimiter } from "../../../src/utils/rate-limiter.js";
import finnhubQuoteFixture from "../../fixtures/finnhub-quote.json";

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

const unlimitedLimiter = new RateLimiter("finnhub", 9999, 9999);

describe("FinnhubProvider", () => {
  describe("quote()", () => {
    it("returns a normalised Quote with all price fields", async () => {
      mockFetch(finnhubQuoteFixture);
      const provider = new FinnhubProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const [quote] = await provider.quote(["AAPL"]);

      expect(quote?.symbol).toBe("AAPL");
      expect(quote?.price).toBe(189.84);
      expect(quote?.change).toBeCloseTo(1.52, 2);
      expect(quote?.changePercent).toBeCloseTo(0.8072, 2);
      expect(quote?.open).toBe(188.5);
      expect(quote?.high).toBe(190.32);
      expect(quote?.low).toBe(188.19);
      expect(quote?.previousClose).toBe(188.32);
      expect(quote?.provider).toBe("finnhub");

      vi.unstubAllGlobals();
    });

    it("timestamp is a valid Date from Unix epoch", async () => {
      mockFetch(finnhubQuoteFixture);
      const provider = new FinnhubProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const [quote] = await provider.quote(["AAPL"]);

      expect(quote?.timestamp).toBeInstanceOf(Date);
      // 1709744400 * 1000 = 2024-03-06T13:00:00.000Z
      expect(quote?.timestamp.getFullYear()).toBe(2024);

      vi.unstubAllGlobals();
    });

    it("throws ProviderError when c === 0 (no data)", async () => {
      mockFetch({ c: 0, d: 0, dp: 0, h: 0, l: 0, o: 0, pc: 0, t: 0 });
      const provider = new FinnhubProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      await expect(provider.quote(["INVALID"])).rejects.toThrow(ProviderError);
      vi.unstubAllGlobals();
    });

    it("includes raw response when raw:true", async () => {
      mockFetch(finnhubQuoteFixture);
      const provider = new FinnhubProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
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
            json: async () => finnhubQuoteFixture,
          };
        }),
      );

      const provider = new FinnhubProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const quotes = await provider.quote(["AAPL", "MSFT", "GOOGL"]);
      expect(quotes).toHaveLength(3);
      expect(callCount).toBe(3);
      vi.unstubAllGlobals();
    });
  });

  describe("historical()", () => {
    it("returns sorted HistoricalBar array for ok response", async () => {
      mockFetch({
        s: "ok",
        t: [1704067200, 1704153600, 1704240000],
        o: [185.0, 186.0, 187.0],
        h: [186.5, 187.5, 188.5],
        l: [184.0, 185.0, 186.0],
        c: [186.0, 187.0, 188.0],
        v: [40000000, 42000000, 38000000],
      });

      const provider = new FinnhubProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const bars = await provider.historical("AAPL");

      expect(bars).toHaveLength(3);
      expect(bars[0]?.date).toBeInstanceOf(Date);
      expect(bars[0]?.open).toBe(185.0);
      expect(bars[0]?.close).toBe(186.0);
      expect(bars[0]?.volume).toBe(40000000);

      vi.unstubAllGlobals();
    });

    it("throws ProviderError when s === 'no_data'", async () => {
      mockFetch({ s: "no_data", t: [], o: [], h: [], l: [], c: [], v: [] });
      const provider = new FinnhubProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      await expect(provider.historical("AAPL")).rejects.toThrow(ProviderError);
      vi.unstubAllGlobals();
    });

    it("maps interval to correct Finnhub resolution", async () => {
      const captured: string[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(async (url: string) => {
          captured.push(url);
          return {
            ok: true,
            headers: { get: () => "application/json" },
            json: async () => ({ s: "ok", t: [], o: [], h: [], l: [], c: [], v: [] }),
          };
        }),
      );

      const provider = new FinnhubProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      await provider.historical("AAPL", { interval: "1d" });
      await provider.historical("AAPL", { interval: "1wk" });
      await provider.historical("AAPL", { interval: "1mo" });

      expect(captured[0]).toContain("resolution=D");
      expect(captured[1]).toContain("resolution=W");
      expect(captured[2]).toContain("resolution=M");

      vi.unstubAllGlobals();
    });
  });

  describe("search()", () => {
    it("returns normalised SearchResult array", async () => {
      mockFetch({
        count: 2,
        result: [
          { description: "APPLE INC", displaySymbol: "AAPL", symbol: "AAPL", type: "Common Stock" },
          {
            description: "APPLE INC CDR",
            displaySymbol: "AAPL.NE",
            symbol: "AAPL.NE",
            type: "Common Stock",
          },
        ],
      });

      const provider = new FinnhubProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const results = await provider.search("apple");

      expect(results).toHaveLength(2);
      expect(results[0]?.symbol).toBe("AAPL");
      expect(results[0]?.name).toBe("APPLE INC");
      expect(results[0]?.type).toBe("stock");
      expect(results[0]?.provider).toBe("finnhub");

      vi.unstubAllGlobals();
    });

    it("maps ETP to etf type", async () => {
      mockFetch({
        count: 1,
        result: [{ description: "SPDR S&P 500", displaySymbol: "SPY", symbol: "SPY", type: "ETP" }],
      });

      const provider = new FinnhubProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const [result] = await provider.search("SPY");
      expect(result?.type).toBe("etf");

      vi.unstubAllGlobals();
    });

    it("respects limit option", async () => {
      const manyResults = Array.from({ length: 20 }, (_, i) => ({
        description: `Company ${i}`,
        displaySymbol: `SYM${i}`,
        symbol: `SYM${i}`,
        type: "Common Stock",
      }));
      mockFetch({ count: 20, result: manyResults });

      const provider = new FinnhubProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const results = await provider.search("test", { limit: 5 });
      expect(results).toHaveLength(5);

      vi.unstubAllGlobals();
    });

    it("returns empty array when result is missing", async () => {
      mockFetch({ count: 0 });
      const provider = new FinnhubProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const results = await provider.search("xyz");
      expect(results).toEqual([]);
      vi.unstubAllGlobals();
    });
  });

  describe("company()", () => {
    it("returns CompanyProfile with all available fields", async () => {
      mockFetch({
        ticker: "AAPL",
        name: "Apple Inc",
        country: "US",
        currency: "USD",
        exchange: "NASDAQ/NMS (GLOBAL MARKET)",
        finnhubIndustry: "Technology",
        ipo: "1980-12-12",
        logo: "https://static.finnhub.io/logo/apple.png",
        marketCapitalization: 2900000,
        weburl: "https://www.apple.com/",
        ggroup: "Technology Hardware & Equipment",
        gind: "Technology Hardware, Storage & Peripherals",
        gsector: "Information Technology",
        gsubind: "Technology Hardware, Storage & Peripherals",
        shareOutstanding: 15441.88,
        phone: "14089961010",
      });

      const provider = new FinnhubProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const profile = await provider.company("AAPL");

      expect(profile.symbol).toBe("AAPL");
      expect(profile.name).toBe("Apple Inc");
      expect(profile.country).toBe("US");
      expect(profile.currency).toBe("USD");
      expect(profile.sector).toBe("Information Technology");
      expect(profile.industry).toBe("Technology Hardware, Storage & Peripherals");
      expect(profile.website).toBe("https://www.apple.com/");
      expect(profile.marketCap).toBe(2900000 * 1_000_000);
      expect(profile.ipoDate).toBeInstanceOf(Date);
      expect(profile.provider).toBe("finnhub");

      vi.unstubAllGlobals();
    });

    it("throws ProviderError when name is empty", async () => {
      mockFetch({ ticker: "INVALID", name: "" });
      const provider = new FinnhubProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      await expect(provider.company("INVALID")).rejects.toThrow(ProviderError);
      vi.unstubAllGlobals();
    });
  });

  describe("news()", () => {
    it("returns normalised NewsItem array", async () => {
      mockFetch([
        {
          id: 12345678,
          headline: "Apple Reports Record Earnings",
          summary: "Apple Inc. reported record earnings for Q1...",
          url: "https://example.com/article",
          source: "Reuters",
          datetime: 1709744400,
          related: "AAPL,MSFT",
          image: "https://example.com/img.jpg",
          category: "company news",
        },
        {
          id: 12345679,
          headline: "iPhone Sales Beat Expectations",
          summary: "",
          url: "https://example.com/article2",
          source: "Bloomberg",
          datetime: 1709740800,
          related: "AAPL",
          image: "",
          category: "company news",
        },
      ]);

      const provider = new FinnhubProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const news = await provider.news("AAPL");

      expect(news).toHaveLength(2);
      expect(news[0]?.id).toBe("12345678");
      expect(news[0]?.title).toBe("Apple Reports Record Earnings");
      expect(news[0]?.summary).toBe("Apple Inc. reported record earnings for Q1...");
      expect(news[0]?.source).toBe("Reuters");
      expect(news[0]?.publishedAt).toBeInstanceOf(Date);
      expect(news[0]?.symbols).toContain("AAPL");
      expect(news[0]?.symbols).toContain("MSFT");
      expect(news[0]?.thumbnail).toBe("https://example.com/img.jpg");
      expect(news[0]?.provider).toBe("finnhub");

      // Empty summary and image should be undefined
      expect(news[1]?.summary).toBeUndefined();
      expect(news[1]?.thumbnail).toBeUndefined();

      vi.unstubAllGlobals();
    });

    it("throws ProviderError when response is not an array", async () => {
      mockFetch({ error: "something went wrong" });
      const provider = new FinnhubProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      await expect(provider.news("AAPL")).rejects.toThrow(ProviderError);
      vi.unstubAllGlobals();
    });

    it("respects limit option", async () => {
      const manyArticles = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        headline: `Article ${i}`,
        summary: "",
        url: `https://example.com/${i}`,
        source: "Source",
        datetime: 1709744400,
        related: "AAPL",
        image: "",
        category: "news",
      }));
      mockFetch(manyArticles);

      const provider = new FinnhubProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const news = await provider.news("AAPL", { limit: 3 });
      expect(news).toHaveLength(3);

      vi.unstubAllGlobals();
    });
  });
});
