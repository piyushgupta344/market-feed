import { describe, expect, it, vi } from "vitest";
import { ProviderError } from "../../../src/errors.js";
import { TiingoProvider } from "../../../src/providers/tiingo/index.js";
import { RateLimiter } from "../../../src/utils/rate-limiter.js";
import tiingoDailyFixture from "../../fixtures/tiingo-daily.json";
import tiingoIexFixture from "../../fixtures/tiingo-iex.json";
import tiingoMetaFixture from "../../fixtures/tiingo-meta.json";
import tiingoNewsFixture from "../../fixtures/tiingo-news.json";
import tiingoSearchFixture from "../../fixtures/tiingo-search.json";

const unlimitedLimiter = new RateLimiter("tiingo", 9999, 9999);

// For quote(), the provider hits two endpoints in parallel — IEX + meta
// We route by URL to return the right fixture for each.
function mockFetchByUrl(routes: Record<string, unknown>, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (url: string) => {
      const matched = Object.entries(routes).find(([pattern]) => url.includes(pattern));
      const body = matched ? matched[1] : { detail: "Not Found" };
      return {
        ok,
        status: ok ? 200 : 404,
        statusText: ok ? "OK" : "Not Found",
        headers: { get: () => "application/json" },
        json: async () => body,
      };
    }),
  );
}

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

describe("TiingoProvider", () => {
  // ---------------------------------------------------------------------------
  // quote()
  // ---------------------------------------------------------------------------

  describe("quote()", () => {
    it("returns a normalised Quote from IEX data", async () => {
      mockFetchByUrl({
        "/iex/": tiingoIexFixture,
        "/tiingo/daily/": tiingoMetaFixture,
      });

      const provider = new TiingoProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const [quote] = await provider.quote(["AAPL"]);

      expect(quote?.symbol).toBe("AAPL");
      expect(quote?.name).toBe("Apple Inc");
      expect(quote?.price).toBeCloseTo(187.94, 2);
      expect(quote?.open).toBeCloseTo(180.02, 2);
      expect(quote?.high).toBeCloseTo(190.32, 2);
      expect(quote?.low).toBeCloseTo(185.19, 2);
      expect(quote?.previousClose).toBeCloseTo(186.86, 2);
      expect(quote?.volume).toBe(50123456);
      expect(quote?.exchange).toBe("NASDAQ");
      expect(quote?.currency).toBe("USD");
      expect(quote?.provider).toBe("tiingo");
      vi.unstubAllGlobals();
    });

    it("computes change and changePercent from last and prevClose", async () => {
      mockFetchByUrl({
        "/iex/": tiingoIexFixture,
        "/tiingo/daily/": tiingoMetaFixture,
      });

      const provider = new TiingoProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const [quote] = await provider.quote(["AAPL"]);

      expect(quote?.change).toBeCloseTo(187.94 - 186.86, 2);
      expect(quote?.changePercent).toBeCloseTo(((187.94 - 186.86) / 186.86) * 100, 2);
      vi.unstubAllGlobals();
    });

    it("timestamp is a valid Date", async () => {
      mockFetchByUrl({
        "/iex/": tiingoIexFixture,
        "/tiingo/daily/": tiingoMetaFixture,
      });

      const provider = new TiingoProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const [quote] = await provider.quote(["AAPL"]);

      expect(quote?.timestamp).toBeInstanceOf(Date);
      expect(quote?.timestamp.getFullYear()).toBe(2024);
      vi.unstubAllGlobals();
    });

    it("throws ProviderError when IEX returns empty array", async () => {
      mockFetchByUrl({
        "/iex/": [],
        "/tiingo/daily/": tiingoMetaFixture,
      });

      const provider = new TiingoProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      await expect(provider.quote(["INVALID"])).rejects.toThrow(ProviderError);
      vi.unstubAllGlobals();
    });

    it("uses Authorization header for auth", async () => {
      const captured: Record<string, string>[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
          captured.push(init.headers as Record<string, string>);
          return {
            ok: true,
            headers: { get: () => "application/json" },
            json: async () => tiingoIexFixture,
          };
        }),
      );

      const provider = new TiingoProvider({ apiKey: "mytiingokey", rateLimiter: unlimitedLimiter });
      await provider.quote(["AAPL"]).catch(() => {});
      expect(captured[0]?.["Authorization"]).toBe("Token mytiingokey");
      vi.unstubAllGlobals();
    });
  });

  // ---------------------------------------------------------------------------
  // historical()
  // ---------------------------------------------------------------------------

  describe("historical()", () => {
    it("returns HistoricalBar array in chronological order", async () => {
      mockFetch(tiingoDailyFixture);
      const provider = new TiingoProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const bars = await provider.historical("AAPL");

      expect(bars).toHaveLength(3);
      expect(bars[0]?.date).toBeInstanceOf(Date);
      expect(bars[0]?.date.toISOString().slice(0, 10)).toBe("2024-03-04");
      expect(bars[2]?.date.toISOString().slice(0, 10)).toBe("2024-03-06");
      vi.unstubAllGlobals();
    });

    it("maps all OHLCV fields and adjClose correctly", async () => {
      mockFetch(tiingoDailyFixture);
      const provider = new TiingoProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const bars = await provider.historical("AAPL");

      const last = bars[2]!;
      expect(last.open).toBeCloseTo(169.15001, 4);
      expect(last.high).toBeCloseTo(170.72999, 4);
      expect(last.low).toBeCloseTo(168.49001, 4);
      expect(last.close).toBeCloseTo(169.12, 2);
      expect(last.adjClose).toBeCloseTo(169.12, 2);
      expect(last.volume).toBe(68887100);
      vi.unstubAllGlobals();
    });

    it("throws ProviderError on error response", async () => {
      mockFetch({ detail: "Not found." }, false, 404);
      const provider = new TiingoProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      await expect(provider.historical("INVALID")).rejects.toThrow(ProviderError);
      vi.unstubAllGlobals();
    });

    it("throws ProviderError when array is empty", async () => {
      mockFetch([]);
      const provider = new TiingoProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      await expect(provider.historical("AAPL")).rejects.toThrow(ProviderError);
      vi.unstubAllGlobals();
    });

    it("passes startDate and endDate from period1/period2", async () => {
      const captured: string[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(async (url: string) => {
          captured.push(url);
          return {
            ok: true,
            headers: { get: () => "application/json" },
            json: async () => tiingoDailyFixture,
          };
        }),
      );

      const provider = new TiingoProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      await provider.historical("AAPL", { period1: "2024-01-01", period2: "2024-12-31" });

      expect(captured[0]).toContain("startDate=2024-01-01");
      expect(captured[0]).toContain("endDate=2024-12-31");
      vi.unstubAllGlobals();
    });

    it("includes raw on each bar when raw:true", async () => {
      mockFetch(tiingoDailyFixture);
      const provider = new TiingoProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
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
      mockFetch(tiingoSearchFixture);
      const provider = new TiingoProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const results = await provider.search("apple");

      expect(results).toHaveLength(2);
      expect(results[0]?.symbol).toBe("AAPL");
      expect(results[0]?.name).toBe("Apple Inc");
      expect(results[0]?.type).toBe("stock");
      expect(results[0]?.exchange).toBe("NASDAQ");
      expect(results[0]?.provider).toBe("tiingo");
      vi.unstubAllGlobals();
    });

    it("respects limit option", async () => {
      mockFetch(tiingoSearchFixture);
      const provider = new TiingoProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const results = await provider.search("apple", { limit: 1 });
      expect(results).toHaveLength(1);
      vi.unstubAllGlobals();
    });

    it("returns empty array or throws on error response", async () => {
      mockFetch({ detail: "Invalid query" }, false, 400);
      const provider = new TiingoProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      // HttpClient throws on non-ok — catch and treat as empty
      const results = await provider.search("xyz").catch((): unknown[] => []);
      expect(Array.isArray(results)).toBe(true);
      vi.unstubAllGlobals();
    });
  });

  // ---------------------------------------------------------------------------
  // company()
  // ---------------------------------------------------------------------------

  describe("company()", () => {
    it("returns CompanyProfile from metadata", async () => {
      mockFetch(tiingoMetaFixture);
      const provider = new TiingoProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const profile = await provider.company("AAPL");

      expect(profile.symbol).toBe("AAPL");
      expect(profile.name).toBe("Apple Inc");
      expect(profile.description).toContain("Apple Inc.");
      expect(profile.exchange).toBe("NASDAQ");
      expect(profile.provider).toBe("tiingo");
      vi.unstubAllGlobals();
    });

    it("throws ProviderError when response has detail field", async () => {
      mockFetch({ detail: "Not found." }, false, 404);
      const provider = new TiingoProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      await expect(provider.company("INVALID")).rejects.toThrow(ProviderError);
      vi.unstubAllGlobals();
    });

    it("throws ProviderError when name is empty", async () => {
      mockFetch({
        ticker: "XYZ",
        name: "",
        description: "",
        startDate: "",
        endDate: "",
        exchangeCode: "NYSE",
      });
      const provider = new TiingoProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      await expect(provider.company("XYZ")).rejects.toThrow(ProviderError);
      vi.unstubAllGlobals();
    });
  });

  // ---------------------------------------------------------------------------
  // news()
  // ---------------------------------------------------------------------------

  describe("news()", () => {
    it("returns normalised NewsItem array", async () => {
      mockFetch(tiingoNewsFixture);
      const provider = new TiingoProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const news = await provider.news("AAPL");

      expect(news).toHaveLength(2);
      expect(news[0]?.id).toBe("12345678");
      expect(news[0]?.title).toBe("Apple Reports Record Q1 2024 Earnings");
      expect(news[0]?.source).toBe("Reuters");
      expect(news[0]?.publishedAt).toBeInstanceOf(Date);
      expect(news[0]?.symbols).toContain("AAPL");
      expect(news[0]?.symbols).toContain("MSFT");
      expect(news[0]?.provider).toBe("tiingo");
      vi.unstubAllGlobals();
    });

    it("maps empty description to undefined summary", async () => {
      mockFetch(tiingoNewsFixture);
      const provider = new TiingoProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const news = await provider.news("AAPL");
      // Second article has empty description
      expect(news[1]?.summary).toBeUndefined();
      vi.unstubAllGlobals();
    });

    it("respects limit option", async () => {
      mockFetch(tiingoNewsFixture);
      const provider = new TiingoProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      const news = await provider.news("AAPL", { limit: 1 });
      expect(news).toHaveLength(1);
      vi.unstubAllGlobals();
    });

    it("throws ProviderError when response is not an array", async () => {
      mockFetch({ detail: "Invalid" });
      const provider = new TiingoProvider({ apiKey: "demo", rateLimiter: unlimitedLimiter });
      await expect(provider.news("AAPL")).rejects.toThrow(ProviderError);
      vi.unstubAllGlobals();
    });
  });
});
