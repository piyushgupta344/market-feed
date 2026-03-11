import { describe, expect, it, vi } from "vitest";
import { ProviderError } from "../../../src/errors.js";
import { PolygonProvider } from "../../../src/providers/polygon/index.js";
import { RateLimiter } from "../../../src/utils/rate-limiter.js";
import polygonFixture from "../../fixtures/polygon-snapshot.json";

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

const unlimitedLimiter = new RateLimiter("polygon", 9999, 9999);

describe("PolygonProvider", () => {
  describe("quote()", () => {
    it("returns a normalised Quote with all price fields", async () => {
      mockFetch(polygonFixture);
      const provider = new PolygonProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const [quote] = await provider.quote(["AAPL"]);

      expect(quote?.symbol).toBe("AAPL");
      expect(quote?.price).toBe(189.84);
      expect(quote?.change).toBeCloseTo(1.52, 2);
      expect(quote?.changePercent).toBeCloseTo(0.8072, 2);
      expect(quote?.open).toBe(188.5);
      expect(quote?.high).toBe(190.32);
      expect(quote?.low).toBe(188.19);
      expect(quote?.close).toBe(189.84);
      expect(quote?.previousClose).toBe(188.32);
      expect(quote?.volume).toBe(52279800);
      expect(quote?.currency).toBe("USD");
      expect(quote?.provider).toBe("polygon");

      vi.unstubAllGlobals();
    });

    it("timestamp is a valid Date", async () => {
      mockFetch(polygonFixture);
      const provider = new PolygonProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const [quote] = await provider.quote(["AAPL"]);
      expect(quote?.timestamp).toBeInstanceOf(Date);
      expect(quote?.timestamp.getFullYear()).toBeGreaterThanOrEqual(2024);

      vi.unstubAllGlobals();
    });

    it("handles batch of multiple tickers in tickers array", async () => {
      const batchFixture = {
        status: "OK",
        tickers: [
          { ...polygonFixture.ticker, ticker: "AAPL" },
          { ...polygonFixture.ticker, ticker: "MSFT" },
        ],
      };
      mockFetch(batchFixture);
      const provider = new PolygonProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const quotes = await provider.quote(["AAPL", "MSFT"]);
      expect(quotes).toHaveLength(2);
      expect(quotes[0]?.symbol).toBe("AAPL");
      expect(quotes[1]?.symbol).toBe("MSFT");

      vi.unstubAllGlobals();
    });

    it("throws ProviderError when status is ERROR", async () => {
      mockFetch({ status: "ERROR", error: "Not authorized." });
      const provider = new PolygonProvider({ apiKey: "invalid", rateLimiter: unlimitedLimiter });
      await expect(provider.quote(["AAPL"])).rejects.toThrow(ProviderError);
      vi.unstubAllGlobals();
    });

    it("throws ProviderError when no tickers returned", async () => {
      mockFetch({ status: "OK" }); // no ticker or tickers field
      const provider = new PolygonProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      await expect(provider.quote(["AAPL"])).rejects.toThrow(ProviderError);
      vi.unstubAllGlobals();
    });

    it("includes raw response when raw:true", async () => {
      mockFetch(polygonFixture);
      const provider = new PolygonProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const [quote] = await provider.quote(["AAPL"], { raw: true });
      expect(quote?.raw).toBeDefined();
      vi.unstubAllGlobals();
    });
  });

  describe("historical()", () => {
    it("returns sorted HistoricalBar array", async () => {
      mockFetch({
        ticker: "AAPL",
        status: "OK",
        queryCount: 3,
        resultsCount: 3,
        adjusted: true,
        results: [
          { t: 1704067200000, o: 185.0, h: 186.5, l: 184.0, c: 186.0, v: 40000000 },
          { t: 1704153600000, o: 186.0, h: 187.5, l: 185.0, c: 187.0, v: 42000000 },
          { t: 1704240000000, o: 187.0, h: 188.5, l: 186.0, c: 188.0, v: 38000000 },
        ],
      });

      const provider = new PolygonProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const bars = await provider.historical("AAPL");

      expect(bars).toHaveLength(3);
      expect(bars[0]?.date).toBeInstanceOf(Date);
      expect(bars[0]?.open).toBe(185.0);
      expect(bars[0]?.high).toBe(186.5);
      expect(bars[0]?.low).toBe(184.0);
      expect(bars[0]?.close).toBe(186.0);
      expect(bars[0]?.volume).toBe(40000000);

      vi.unstubAllGlobals();
    });

    it("passes correct timespan and multiplier for each interval", async () => {
      const capturedUrls: string[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(async (url: string) => {
          capturedUrls.push(url);
          return {
            ok: true,
            headers: { get: () => "application/json" },
            json: async () => ({ status: "OK", results: [] }),
          };
        }),
      );

      const provider = new PolygonProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });

      await provider.historical("AAPL", { interval: "1d" });
      await provider.historical("AAPL", { interval: "1wk" });
      await provider.historical("AAPL", { interval: "1mo" });

      expect(capturedUrls[0]).toContain("/1/day/");
      expect(capturedUrls[1]).toContain("/1/week/");
      expect(capturedUrls[2]).toContain("/1/month/");

      vi.unstubAllGlobals();
    });

    it("returns empty array when results is undefined", async () => {
      mockFetch({ ticker: "AAPL", status: "OK", queryCount: 0, resultsCount: 0, adjusted: true });
      const provider = new PolygonProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const bars = await provider.historical("AAPL");
      expect(bars).toEqual([]);
      vi.unstubAllGlobals();
    });
  });

  describe("search()", () => {
    it("returns normalised SearchResults", async () => {
      mockFetch({
        status: "OK",
        results: [
          {
            ticker: "AAPL",
            name: "Apple Inc.",
            market: "stocks",
            locale: "us",
            primary_exchange: "XNAS",
            type: "CS",
            active: true,
            currency_name: "usd",
          },
          {
            ticker: "AAPL.BA",
            name: "Apple Inc.",
            market: "stocks",
            locale: "ar",
            primary_exchange: "XBUE",
            type: "CS",
            active: true,
            currency_name: "ars",
          },
        ],
      });

      const provider = new PolygonProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const results = await provider.search("Apple");

      expect(results).toHaveLength(2);
      expect(results[0]?.symbol).toBe("AAPL");
      expect(results[0]?.name).toBe("Apple Inc.");
      expect(results[0]?.exchange).toBe("XNAS");
      expect(results[0]?.currency).toBe("USD"); // uppercased
      expect(results[0]?.provider).toBe("polygon");

      vi.unstubAllGlobals();
    });

    it("maps CS to stock type", async () => {
      mockFetch({
        status: "OK",
        results: [
          {
            ticker: "AAPL",
            name: "Apple",
            market: "stocks",
            locale: "us",
            type: "CS",
            active: true,
          },
        ],
      });
      const provider = new PolygonProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const [result] = await provider.search("AAPL");
      expect(result?.type).toBe("stock");
      vi.unstubAllGlobals();
    });

    it("maps ETF to etf type", async () => {
      mockFetch({
        status: "OK",
        results: [
          {
            ticker: "SPY",
            name: "SPDR S&P 500",
            market: "stocks",
            locale: "us",
            type: "ETF",
            active: true,
          },
        ],
      });
      const provider = new PolygonProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const [result] = await provider.search("SPY");
      expect(result?.type).toBe("etf");
      vi.unstubAllGlobals();
    });

    it("returns empty array when results is missing", async () => {
      mockFetch({ status: "OK" });
      const provider = new PolygonProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const results = await provider.search("xyz");
      expect(results).toEqual([]);
      vi.unstubAllGlobals();
    });
  });

  describe("news()", () => {
    it("returns normalised NewsItem array", async () => {
      mockFetch({
        status: "OK",
        results: [
          {
            id: "article-001",
            title: "Apple Reports Record Q1 Earnings",
            published_utc: "2024-03-06T18:00:00Z",
            article_url: "https://example.com/article-001",
            tickers: ["AAPL"],
            description: "Apple Inc. reported record earnings for Q1 2024...",
            publisher: { name: "Reuters", homepage_url: "https://reuters.com" },
            image_url: "https://example.com/img.jpg",
          },
          {
            id: "article-002",
            title: "iPhone Sales Beat Expectations",
            published_utc: "2024-03-05T12:00:00Z",
            article_url: "https://example.com/article-002",
            tickers: ["AAPL", "QCOM"],
            publisher: { name: "Bloomberg" },
          },
        ],
      });

      const provider = new PolygonProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const news = await provider.news("AAPL");

      expect(news).toHaveLength(2);

      expect(news[0]?.id).toBe("article-001");
      expect(news[0]?.title).toBe("Apple Reports Record Q1 Earnings");
      expect(news[0]?.summary).toBe("Apple Inc. reported record earnings for Q1 2024...");
      expect(news[0]?.url).toBe("https://example.com/article-001");
      expect(news[0]?.source).toBe("Reuters");
      expect(news[0]?.publishedAt).toBeInstanceOf(Date);
      expect(news[0]?.symbols).toContain("AAPL");
      expect(news[0]?.thumbnail).toBe("https://example.com/img.jpg");
      expect(news[0]?.provider).toBe("polygon");

      // Article without description — summary should be absent
      expect(news[1]?.summary).toBeUndefined();
      expect(news[1]?.symbols).toContain("QCOM");

      vi.unstubAllGlobals();
    });

    it("passes limit to the API and returns that many results", async () => {
      // The limit param is sent to the Polygon API which returns the matching count.
      // The mock returns exactly 5 items (as the real API would for limit=5).
      mockFetch({
        status: "OK",
        results: Array.from({ length: 5 }, (_, i) => ({
          id: `art-${i}`,
          title: `Article ${i}`,
          published_utc: "2024-03-06T18:00:00Z",
          article_url: `https://example.com/${i}`,
          tickers: ["AAPL"],
          publisher: { name: "Source" },
        })),
      });

      let capturedUrl = "";
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(async (url: string) => {
          capturedUrl = url;
          return {
            ok: true,
            headers: { get: () => "application/json" },
            json: async () => ({
              status: "OK",
              results: Array.from({ length: 5 }, (_, i) => ({
                id: `art-${i}`,
                title: `Article ${i}`,
                published_utc: "2024-03-06T18:00:00Z",
                article_url: `https://example.com/${i}`,
                tickers: ["AAPL"],
                publisher: { name: "Source" },
              })),
            }),
          };
        }),
      );

      const provider = new PolygonProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const news = await provider.news("AAPL", { limit: 5 });

      expect(news).toHaveLength(5);
      expect(capturedUrl).toContain("limit=5");

      vi.unstubAllGlobals();
    });
  });

  describe("company()", () => {
    it("returns CompanyProfile with all available fields", async () => {
      mockFetch({
        status: "OK",
        results: {
          ticker: "AAPL",
          name: "Apple Inc.",
          market: "stocks",
          locale: "us",
          primary_exchange: "XNAS",
          type: "CS",
          active: true,
          currency_name: "usd",
          description: "Apple Inc. designs consumer electronics...",
          sic_code: "3571",
          sic_description: "Electronic Computers",
          homepage_url: "https://www.apple.com",
          total_employees: 164000,
          list_date: "1980-12-12",
          market_cap: 2900000000000,
          address: {
            address1: "One Apple Park Way",
            city: "Cupertino",
            state: "CA",
            country: "US",
            postal_code: "95014",
          },
        },
      });

      const provider = new PolygonProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const profile = await provider.company("AAPL");

      expect(profile.symbol).toBe("AAPL");
      expect(profile.name).toBe("Apple Inc.");
      expect(profile.description).toContain("Apple Inc.");
      expect(profile.sector).toBe("Electronic Computers");
      expect(profile.country).toBe("US");
      expect(profile.employees).toBe(164000);
      expect(profile.website).toBe("https://www.apple.com");
      expect(profile.marketCap).toBe(2900000000000);
      expect(profile.exchange).toBe("XNAS");
      expect(profile.ipoDate).toBeInstanceOf(Date);
      expect(profile.provider).toBe("polygon");

      vi.unstubAllGlobals();
    });

    it("throws ProviderError when results field is missing", async () => {
      mockFetch({ status: "OK" });
      const provider = new PolygonProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      await expect(provider.company("INVALID")).rejects.toThrow(ProviderError);
      vi.unstubAllGlobals();
    });

    it("throws ProviderError when status is ERROR", async () => {
      mockFetch({ status: "ERROR", error: "ticker not found" });
      const provider = new PolygonProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      await expect(provider.company("NOTREAL")).rejects.toThrow(ProviderError);
      vi.unstubAllGlobals();
    });
  });
});
