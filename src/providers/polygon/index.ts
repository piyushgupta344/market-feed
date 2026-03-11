import { ProviderError } from "../../errors.js";
import { HttpClient } from "../../http/client.js";
import type { CompanyOptions, CompanyProfile } from "../../types/company.js";
import type { HistoricalBar, HistoricalOptions } from "../../types/historical.js";
import type { NewsItem, NewsOptions } from "../../types/news.js";
import type { MarketProvider } from "../../types/provider.js";
import type { Quote, QuoteOptions } from "../../types/quote.js";
import type { SearchOptions, SearchResult } from "../../types/search.js";
import { RateLimiter } from "../../utils/rate-limiter.js";
import { normalise } from "../../utils/symbol.js";
import {
  transformCompany,
  transformHistoricalBar,
  transformNews,
  transformQuote,
  transformSearch,
} from "./transform.js";
import type {
  PolygonAggregatesResponse,
  PolygonNewsResponse,
  PolygonSnapshotResponse,
  PolygonTickerDetailsResponse,
  PolygonTickersResponse,
} from "./types.js";

export interface PolygonProviderOptions {
  apiKey: string;
  /** Request timeout in milliseconds. Defaults to 10 000. */
  timeoutMs?: number;
  /** Retry attempts on transient failures. Defaults to 2. */
  retries?: number;
  /**
   * Override the rate limiter.
   * Free tier: 5 calls/minute. Unlimited for paid plans.
   */
  rateLimiter?: RateLimiter;
}

/**
 * Polygon.io provider.
 *
 * Free tier provides 15-minute delayed data with 5 API calls per minute.
 * Paid plans unlock real-time data and higher rate limits.
 */
export class PolygonProvider implements MarketProvider {
  readonly name = "polygon";

  private readonly http: HttpClient;
  private readonly limiter: RateLimiter;

  /** API key exposed for WebSocket authentication in `market-feed/ws`. */
  get wsApiKey(): string {
    return this.options.apiKey;
  }

  constructor(private readonly options: PolygonProviderOptions) {
    this.http = new HttpClient("polygon", {
      baseUrl: "https://api.polygon.io",
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
      ...(options.retries !== undefined ? { retries: options.retries } : {}),
      headers: { Authorization: `Bearer ${options.apiKey}` },
    });
    // Free tier: 5 calls/minute
    this.limiter = options.rateLimiter ?? new RateLimiter("polygon", 5, 5 / 60);
  }

  // ---------------------------------------------------------------------------
  // Quote — snapshot endpoint
  // ---------------------------------------------------------------------------
  async quote(symbols: string[], options?: QuoteOptions): Promise<Quote[]> {
    this.limiter.consume();

    const tickers = symbols.map(normalise).join(",");
    const data = await this.http.get<PolygonSnapshotResponse>(
      `/v2/snapshot/locale/us/markets/stocks/tickers`,
      { params: { tickers, apiKey: this.options.apiKey } },
    );

    this.assertSuccess(data as { status: string; error?: string });

    const tickerList = data.tickers ?? (data.ticker ? [data.ticker] : []);
    if (tickerList.length === 0) {
      throw new ProviderError(`No snapshot data for "${tickers}"`, this.name);
    }

    return tickerList.map((t) => transformQuote(t, options?.raw ? t : undefined));
  }

  // ---------------------------------------------------------------------------
  // Historical — aggregates endpoint
  // ---------------------------------------------------------------------------
  async historical(symbol: string, options?: HistoricalOptions): Promise<HistoricalBar[]> {
    this.limiter.consume();

    const s = normalise(symbol);
    const interval = options?.interval ?? "1d";
    const { multiplier, timespan } = parseInterval(interval);

    const period1 = toDateString(options?.period1 ?? subtractOneYear());
    const period2 = toDateString(options?.period2 ?? new Date());

    const data = await this.http.get<PolygonAggregatesResponse>(
      `/v2/aggs/ticker/${s}/range/${multiplier}/${timespan}/${period1}/${period2}`,
      {
        params: {
          adjusted: true,
          sort: "asc",
          limit: 50000,
          apiKey: this.options.apiKey,
        },
      },
    );

    this.assertSuccess(data as { status: string; error?: string });

    return (data.results ?? []).map((bar) =>
      transformHistoricalBar(bar, options?.raw ? bar : undefined),
    );
  }

  // ---------------------------------------------------------------------------
  // Search — reference tickers endpoint
  // ---------------------------------------------------------------------------
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    this.limiter.consume();

    const limit = options?.limit ?? 10;
    const data = await this.http.get<PolygonTickersResponse>("/v3/reference/tickers", {
      params: {
        search: query,
        active: true,
        limit,
        apiKey: this.options.apiKey,
      },
    });

    this.assertSuccess(data as { status: string; error?: string });

    return (data.results ?? []).map((t) => transformSearch(t, options?.raw ? t : undefined));
  }

  // ---------------------------------------------------------------------------
  // Company — ticker details v3
  // ---------------------------------------------------------------------------
  async company(symbol: string, options?: CompanyOptions): Promise<CompanyProfile> {
    this.limiter.consume();

    const s = normalise(symbol);
    const data = await this.http.get<PolygonTickerDetailsResponse>(`/v3/reference/tickers/${s}`, {
      params: { apiKey: this.options.apiKey },
    });

    this.assertSuccess(data as { status: string; error?: string });

    if (!data.results) {
      throw new ProviderError(`No company data for "${s}"`, this.name);
    }

    return transformCompany(data.results, options?.raw ? data : undefined);
  }

  // ---------------------------------------------------------------------------
  // News — ticker news endpoint
  // ---------------------------------------------------------------------------
  async news(symbol: string, options?: NewsOptions): Promise<NewsItem[]> {
    this.limiter.consume();

    const s = normalise(symbol);
    const limit = options?.limit ?? 10;

    const data = await this.http.get<PolygonNewsResponse>("/v2/reference/news", {
      params: {
        ticker: s,
        limit,
        order: "desc",
        sort: "published_utc",
        apiKey: this.options.apiKey,
      },
    });

    this.assertSuccess(data as { status: string; error?: string });

    return (data.results ?? []).map((a) => transformNews(a, options?.raw ? a : undefined));
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------
  private assertSuccess(response: { status: string; error?: string }): void {
    if (response.status === "ERROR" || response.error) {
      throw new ProviderError(
        response.error ?? `Polygon returned status "${response.status}"`,
        this.name,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Interval parsing helpers
// ---------------------------------------------------------------------------
function parseInterval(interval: string): { multiplier: number; timespan: string } {
  const map: Record<string, { multiplier: number; timespan: string }> = {
    "1m": { multiplier: 1, timespan: "minute" },
    "2m": { multiplier: 2, timespan: "minute" },
    "5m": { multiplier: 5, timespan: "minute" },
    "15m": { multiplier: 15, timespan: "minute" },
    "30m": { multiplier: 30, timespan: "minute" },
    "60m": { multiplier: 60, timespan: "minute" },
    "1h": { multiplier: 1, timespan: "hour" },
    "1d": { multiplier: 1, timespan: "day" },
    "5d": { multiplier: 5, timespan: "day" },
    "1wk": { multiplier: 1, timespan: "week" },
    "1mo": { multiplier: 1, timespan: "month" },
    "3mo": { multiplier: 3, timespan: "month" },
  };
  return map[interval] ?? { multiplier: 1, timespan: "day" };
}

function toDateString(date: string | Date): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 10);
}

function subtractOneYear(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d;
}
