import { ProviderError, RateLimitError } from "../../errors.js";
import { HttpClient } from "../../http/client.js";
import type { CompanyOptions, CompanyProfile } from "../../types/company.js";
import type { HistoricalBar, HistoricalOptions } from "../../types/historical.js";
import type { MarketProvider } from "../../types/provider.js";
import type { Quote, QuoteOptions } from "../../types/quote.js";
import type { SearchOptions, SearchResult } from "../../types/search.js";
import { RateLimiter } from "../../utils/rate-limiter.js";
import { normalise } from "../../utils/symbol.js";
import {
  transformCompany,
  transformHistoricalBars,
  transformQuote,
  transformSearch,
} from "./transform.js";
import type {
  AVDailyAdjBar,
  AVGlobalQuoteResponse,
  AVOverviewResponse,
  AVSearchResponse,
  AVTimeSeriesDailyResponse,
} from "./types.js";

export interface AlphaVantageProviderOptions {
  apiKey: string;
  /** Request timeout in milliseconds. Defaults to 10 000. */
  timeoutMs?: number;
  /** Retry attempts on transient failures. Defaults to 2. */
  retries?: number;
  /**
   * Override the rate limiter.
   * Free tier: 5 calls/minute, 25 calls/day.
   * Premium tier: higher — set refillRate accordingly.
   */
  rateLimiter?: RateLimiter;
  /** Custom fetch function, e.g. a CORS proxy wrapper for browser use. */
  fetchFn?: typeof globalThis.fetch;
}

/**
 * Alpha Vantage provider.
 *
 * Free tier: 25 API calls/day, 5 calls/minute.
 * The rate limiter is enforced client-side to avoid burning your daily quota.
 */
export class AlphaVantageProvider implements MarketProvider {
  readonly name = "alpha-vantage";

  private readonly http: HttpClient;
  private readonly apiKey: string;
  private readonly limiter: RateLimiter;

  constructor(options: AlphaVantageProviderOptions) {
    this.apiKey = options.apiKey;
    this.http = new HttpClient("alpha-vantage", {
      baseUrl: "https://www.alphavantage.co",
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
      ...(options.retries !== undefined ? { retries: options.retries } : {}),
      ...(options.fetchFn !== undefined ? { fetchFn: options.fetchFn } : {}),
    });
    // Default: 5 requests/minute burst capacity
    this.limiter = options.rateLimiter ?? new RateLimiter("alpha-vantage", 5, 5 / 60);
  }

  // ---------------------------------------------------------------------------
  // Quote — uses GLOBAL_QUOTE function
  // ---------------------------------------------------------------------------
  async quote(symbols: string[], options?: QuoteOptions): Promise<Quote[]> {
    // AV only supports single-symbol quote; batch sequentially
    const quotes: Quote[] = [];
    for (const symbol of symbols) {
      this.limiter.consume();
      quotes.push(await this.fetchSingleQuote(symbol, options));
    }
    return quotes;
  }

  private async fetchSingleQuote(symbol: string, options?: QuoteOptions): Promise<Quote> {
    const s = normalise(symbol);
    const data = await this.http.get<AVGlobalQuoteResponse>("/query", {
      params: { function: "GLOBAL_QUOTE", symbol: s, apikey: this.apiKey },
    });

    this.checkRateLimit(data as Record<string, unknown>);

    const gq = data["Global Quote"];
    if (!gq || !gq["01. symbol"]) {
      throw new ProviderError(`No quote data returned for "${s}"`, this.name);
    }

    return transformQuote(gq, options?.raw ? data : undefined);
  }

  // ---------------------------------------------------------------------------
  // Historical — uses TIME_SERIES_DAILY_ADJUSTED
  // ---------------------------------------------------------------------------
  async historical(symbol: string, options?: HistoricalOptions): Promise<HistoricalBar[]> {
    this.limiter.consume();

    const s = normalise(symbol);
    const outputsize = "full"; // always fetch full; filter client-side

    const data = await this.http.get<AVTimeSeriesDailyResponse>("/query", {
      params: {
        function: "TIME_SERIES_DAILY_ADJUSTED",
        symbol: s,
        outputsize,
        apikey: this.apiKey,
      },
    });

    this.checkRateLimit(data as Record<string, unknown>);

    const timeSeries = data["Time Series (Daily Adjusted)"] ?? data["Time Series (Daily)"];
    if (!timeSeries) {
      throw new ProviderError(`No historical data returned for "${s}"`, this.name);
    }

    const period1 = options?.period1
      ? new Date(options.period1)
      : (() => {
          const d = new Date();
          d.setFullYear(d.getFullYear() - 1);
          return d;
        })();
    const period2 = options?.period2 ? new Date(options.period2) : new Date();

    return transformHistoricalBars(
      timeSeries as Record<string, AVDailyAdjBar>,
      period1,
      period2,
      options?.raw ? data : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // Search — uses SYMBOL_SEARCH
  // ---------------------------------------------------------------------------
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    this.limiter.consume();

    const data = await this.http.get<AVSearchResponse>("/query", {
      params: { function: "SYMBOL_SEARCH", keywords: query, apikey: this.apiKey },
    });

    this.checkRateLimit(data as Record<string, unknown>);

    const limit = options?.limit ?? 10;
    return (data.bestMatches ?? [])
      .slice(0, limit)
      .map((m) => transformSearch(m, options?.raw ? m : undefined));
  }

  // ---------------------------------------------------------------------------
  // Company — uses OVERVIEW
  // ---------------------------------------------------------------------------
  async company(symbol: string, options?: CompanyOptions): Promise<CompanyProfile> {
    this.limiter.consume();

    const s = normalise(symbol);
    const data = await this.http.get<AVOverviewResponse>("/query", {
      params: { function: "OVERVIEW", symbol: s, apikey: this.apiKey },
    });

    this.checkRateLimit(data as Record<string, unknown>);

    if (!data.Symbol) {
      throw new ProviderError(`No company overview returned for "${s}"`, this.name);
    }

    return transformCompany(data, options?.raw ? data : undefined);
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------
  private checkRateLimit(data: Record<string, unknown>): void {
    const info = data["Information"] as string | undefined;
    const note = data["Note"] as string | undefined;
    const msg = info ?? note ?? "";
    if (msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("api call")) {
      throw new RateLimitError(this.name);
    }
  }
}
