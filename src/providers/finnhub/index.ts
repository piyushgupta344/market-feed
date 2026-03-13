import { ProviderError } from "../../errors.js";
import { HttpClient } from "../../http/client.js";
import type { CompanyOptions, CompanyProfile } from "../../types/company.js";
import type { EarningsEvent, EarningsOptions } from "../../types/earnings.js";
import type { HistoricalBar, HistoricalOptions } from "../../types/historical.js";
import type { NewsItem, NewsOptions } from "../../types/news.js";
import type { MarketProvider } from "../../types/provider.js";
import type { Quote, QuoteOptions } from "../../types/quote.js";
import type { SearchOptions, SearchResult } from "../../types/search.js";
import { RateLimiter } from "../../utils/rate-limiter.js";
import { normalise } from "../../utils/symbol.js";
import {
  transformCompany,
  transformEarnings,
  transformHistorical,
  transformNews,
  transformQuote,
  transformSearch,
} from "./transform.js";
import type {
  FinnhubCandlesResponse,
  FinnhubEarningsResponse,
  FinnhubNewsArticle,
  FinnhubProfileResponse,
  FinnhubQuoteResponse,
  FinnhubSearchResponse,
} from "./types.js";

export interface FinnhubProviderOptions {
  apiKey: string;
  /** Request timeout in milliseconds. Defaults to 10 000. */
  timeoutMs?: number;
  /** Retry attempts on transient failures. Defaults to 2. */
  retries?: number;
  /**
   * Override the default rate limiter.
   * Free tier: 60 API calls/minute.
   */
  rateLimiter?: RateLimiter;
  /** Custom fetch function, e.g. a CORS proxy wrapper for browser use. */
  fetchFn?: typeof globalThis.fetch;
}

/**
 * Finnhub.io provider.
 *
 * Free tier provides real-time US stock market data with a 60 calls/minute limit.
 * API key is required — get one free at https://finnhub.io
 */
export class FinnhubProvider implements MarketProvider {
  readonly name = "finnhub";

  private readonly http: HttpClient;
  private readonly limiter: RateLimiter;

  /** API key exposed for WebSocket authentication in `market-feed/ws`. */
  get wsApiKey(): string {
    return this.options.apiKey;
  }

  constructor(private readonly options: FinnhubProviderOptions) {
    this.http = new HttpClient("finnhub", {
      baseUrl: "https://finnhub.io",
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
      ...(options.retries !== undefined ? { retries: options.retries } : {}),
      ...(options.fetchFn !== undefined ? { fetchFn: options.fetchFn } : {}),
      headers: {
        "X-Finnhub-Token": options.apiKey,
        Accept: "application/json",
      },
    });
    // Free tier: 60 calls/minute = 1 call/second
    this.limiter = options.rateLimiter ?? new RateLimiter("finnhub", 60, 1);
  }

  // ---------------------------------------------------------------------------
  // Quote
  // ---------------------------------------------------------------------------

  async quote(symbols: string[], options?: QuoteOptions): Promise<Quote[]> {
    return Promise.all(symbols.map((s) => this.fetchSingleQuote(s, options)));
  }

  private async fetchSingleQuote(symbol: string, options?: QuoteOptions): Promise<Quote> {
    this.limiter.consume();
    const s = normalise(symbol);

    const data = await this.http.get<FinnhubQuoteResponse>("/api/v1/quote", {
      params: { symbol: s },
    });

    // c === 0 means no data for this symbol on Finnhub
    if (!data.c) {
      throw new ProviderError(`No quote data for symbol "${s}"`, this.name);
    }

    return transformQuote(s, data, options?.raw ? data : undefined);
  }

  // ---------------------------------------------------------------------------
  // Historical (candles)
  // ---------------------------------------------------------------------------

  async historical(symbol: string, options?: HistoricalOptions): Promise<HistoricalBar[]> {
    this.limiter.consume();
    const s = normalise(symbol);
    const resolution = toResolution(options?.interval ?? "1d");
    const from = toEpoch(options?.period1 ?? subtractOneYear());
    const to = toEpoch(options?.period2 ?? new Date());

    const data = await this.http.get<FinnhubCandlesResponse>("/api/v1/stock/candle", {
      params: { symbol: s, resolution, from, to },
    });

    if (data.s === "no_data") {
      throw new ProviderError(`No historical data for symbol "${s}"`, this.name);
    }

    return transformHistorical(data, options?.raw ? data : undefined);
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    this.limiter.consume();
    const limit = options?.limit ?? 10;

    const data = await this.http.get<FinnhubSearchResponse>("/api/v1/search", {
      params: { q: query },
    });

    return (data.result ?? [])
      .slice(0, limit)
      .map((r) => transformSearch(r, options?.raw ? r : undefined));
  }

  // ---------------------------------------------------------------------------
  // Company
  // ---------------------------------------------------------------------------

  async company(symbol: string, options?: CompanyOptions): Promise<CompanyProfile> {
    this.limiter.consume();
    const s = normalise(symbol);

    const data = await this.http.get<FinnhubProfileResponse>("/api/v1/stock/profile2", {
      params: { symbol: s },
    });

    if (!data.name) {
      throw new ProviderError(`No company data for symbol "${s}"`, this.name);
    }

    return transformCompany(data, options?.raw ? data : undefined);
  }

  // ---------------------------------------------------------------------------
  // News
  // ---------------------------------------------------------------------------

  async news(symbol: string, options?: NewsOptions): Promise<NewsItem[]> {
    this.limiter.consume();
    const s = normalise(symbol);
    const limit = options?.limit ?? 10;

    const to = toDateString(new Date());
    const from = toDateString(subtractDays(new Date(), 30));

    const data = await this.http.get<FinnhubNewsArticle[]>("/api/v1/company-news", {
      params: { symbol: s, from, to },
    });

    if (!Array.isArray(data)) {
      throw new ProviderError(`Unexpected response for news "${s}"`, this.name);
    }

    return data
      .slice(0, limit)
      .map((article) => transformNews(article, options?.raw ? article : undefined));
  }
  // ---------------------------------------------------------------------------
  // Earnings
  // ---------------------------------------------------------------------------

  async earnings(symbol: string, options?: EarningsOptions): Promise<EarningsEvent[]> {
    this.limiter.consume();
    const s = normalise(symbol);
    const limit = options?.limit ?? 10;

    const data = await this.http.get<FinnhubEarningsResponse>("/api/v1/stock/earnings", {
      params: { symbol: s, limit },
    });

    if (!Array.isArray(data)) {
      throw new ProviderError(`Unexpected earnings response for "${s}"`, this.name);
    }

    return data.map((entry) => transformEarnings(entry, options?.raw ? entry : undefined));
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toResolution(interval: string): string {
  const map: Record<string, string> = {
    "1m": "1",
    "2m": "1",
    "5m": "5",
    "15m": "15",
    "30m": "30",
    "60m": "60",
    "90m": "60",
    "1h": "60",
    "1d": "D",
    "5d": "D",
    "1wk": "W",
    "1mo": "M",
    "3mo": "M",
  };
  return map[interval] ?? "D";
}

function toEpoch(date: string | Date): number {
  const d = date instanceof Date ? date : new Date(date);
  return Math.floor(d.getTime() / 1_000);
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function subtractOneYear(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d;
}

function subtractDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}
