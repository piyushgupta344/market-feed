import { ProviderError } from "../../errors.js";
import { HttpClient } from "../../http/client.js";
import type { CompanyOptions, CompanyProfile } from "../../types/company.js";
import type {
  BalanceSheet,
  CashFlowStatement,
  FundamentalsOptions,
  IncomeStatement,
} from "../../types/fundamentals.js";
import type { HistoricalBar, HistoricalOptions } from "../../types/historical.js";
import type { NewsItem, NewsOptions } from "../../types/news.js";
import type { MarketProvider } from "../../types/provider.js";
import type { Quote, QuoteOptions } from "../../types/quote.js";
import type { SearchOptions, SearchResult } from "../../types/search.js";
import { RateLimiter } from "../../utils/rate-limiter.js";
import { normalise } from "../../utils/symbol.js";
import {
  transformBalanceSheet,
  transformCashFlowStatement,
  transformCompany,
  transformHistoricalBar,
  transformIncomeStatement,
  transformNews,
  transformQuote,
  transformSearch,
} from "./transform.js";
import type {
  TiingoDailyBar,
  TiingoErrorResponse,
  TiingoFundamentalsStatement,
  TiingoIexQuote,
  TiingoMetaResponse,
  TiingoNewsArticle,
  TiingoSearchResultItem,
} from "./types.js";

export interface TiingoProviderOptions {
  apiKey: string;
  /** Request timeout in milliseconds. Defaults to 10 000. */
  timeoutMs?: number;
  /** Retry attempts on transient failures. Defaults to 2. */
  retries?: number;
  /**
   * Override the default rate limiter.
   * Free tier: 50 API calls/hour ≈ ~0.0139 tokens/second.
   */
  rateLimiter?: RateLimiter;
  /** Custom fetch function, e.g. a CORS proxy wrapper for browser use. */
  fetchFn?: typeof globalThis.fetch;
}

/**
 * Tiingo provider.
 *
 * Free tier provides EOD historical prices, real-time IEX quotes, and news.
 * API key required — sign up free at https://www.tiingo.com
 *
 * Rate limit: ~50 calls/hour on free plan.
 */
export class TiingoProvider implements MarketProvider {
  readonly name = "tiingo";

  private readonly http: HttpClient;
  private readonly limiter: RateLimiter;

  constructor(private readonly options: TiingoProviderOptions) {
    this.http = new HttpClient("tiingo", {
      baseUrl: "https://api.tiingo.com",
      headers: {
        Authorization: `Token ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
      ...(options.retries !== undefined ? { retries: options.retries } : {}),
      ...(options.fetchFn !== undefined ? { fetchFn: options.fetchFn } : {}),
    });
    // Free tier: 50 calls/hour ≈ 0.01389 tokens/second
    this.limiter = options.rateLimiter ?? new RateLimiter("tiingo", 50, 50 / 3600);
  }

  // ---------------------------------------------------------------------------
  // Quote (IEX real-time)
  // ---------------------------------------------------------------------------

  async quote(symbols: string[], options?: QuoteOptions): Promise<Quote[]> {
    return Promise.all(symbols.map((s) => this.fetchSingleQuote(s, options)));
  }

  private async fetchSingleQuote(symbol: string, options?: QuoteOptions): Promise<Quote> {
    this.limiter.consume();
    const s = normalise(symbol);

    // Fetch IEX real-time quote and meta in parallel
    const [iexData, metaData] = await Promise.allSettled([
      this.http.get<TiingoIexQuote[] | TiingoErrorResponse>(`/iex/${s}`),
      this.http.get<TiingoMetaResponse | TiingoErrorResponse>(`/tiingo/daily/${s}`),
    ]);

    // IEX quote is required
    if (iexData.status === "rejected") {
      throw new ProviderError(`No quote data for symbol "${s}"`, this.name);
    }

    const iexRaw = iexData.value;

    // Tiingo returns an array from /iex — take first element
    const iex = Array.isArray(iexRaw) ? iexRaw[0] : null;
    if (!iex) {
      throw new ProviderError(`No quote data for symbol "${s}"`, this.name);
    }

    const meta =
      metaData.status === "fulfilled" && !("detail" in metaData.value)
        ? (metaData.value as TiingoMetaResponse)
        : undefined;

    return transformQuote(iex, meta, options?.raw ? { iex, meta } : undefined);
  }

  // ---------------------------------------------------------------------------
  // Historical (EOD daily)
  // ---------------------------------------------------------------------------

  async historical(symbol: string, options?: HistoricalOptions): Promise<HistoricalBar[]> {
    this.limiter.consume();
    const s = normalise(symbol);

    const params: Record<string, string | number | boolean | undefined> = {};

    if (options?.period1 !== undefined) {
      params["startDate"] =
        typeof options.period1 === "string"
          ? options.period1
          : options.period1.toISOString().slice(0, 10);
    }
    if (options?.period2 !== undefined) {
      params["endDate"] =
        typeof options.period2 === "string"
          ? options.period2
          : options.period2.toISOString().slice(0, 10);
    }

    const data = await this.http.get<TiingoDailyBar[] | TiingoErrorResponse>(
      `/tiingo/daily/${s}/prices`,
      { params },
    );

    if (!Array.isArray(data)) {
      throw new ProviderError(
        (data as TiingoErrorResponse).detail ?? `No historical data for symbol "${s}"`,
        this.name,
      );
    }

    if (data.length === 0) {
      throw new ProviderError(`No historical data for symbol "${s}"`, this.name);
    }

    return data.map((bar) => transformHistoricalBar(bar, options?.raw ? bar : undefined));
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    this.limiter.consume();
    const limit = options?.limit ?? 10;

    const data = await this.http.get<TiingoSearchResultItem[] | TiingoErrorResponse>(
      "/tiingo/utilities/search",
      { params: { query, limit } },
    );

    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .slice(0, limit)
      .map((item) => transformSearch(item, options?.raw ? item : undefined));
  }

  // ---------------------------------------------------------------------------
  // Company (metadata)
  // ---------------------------------------------------------------------------

  async company(symbol: string, options?: CompanyOptions): Promise<CompanyProfile> {
    this.limiter.consume();
    const s = normalise(symbol);

    const data = await this.http.get<TiingoMetaResponse | TiingoErrorResponse>(
      `/tiingo/daily/${s}`,
    );

    if ("detail" in data || !("name" in data) || !data.name) {
      throw new ProviderError(
        ("detail" in data ? data.detail : undefined) ?? `No company data for symbol "${s}"`,
        this.name,
      );
    }

    return transformCompany(data as TiingoMetaResponse, options?.raw ? data : undefined);
  }

  // ---------------------------------------------------------------------------
  // Fundamentals
  // ---------------------------------------------------------------------------

  async incomeStatements(
    symbol: string,
    options?: FundamentalsOptions,
  ): Promise<IncomeStatement[]> {
    const stmts = await this.fetchStatements(symbol, options);
    return stmts.map((s) =>
      transformIncomeStatement(s, symbol.toUpperCase(), options?.raw ? s : undefined),
    );
  }

  async balanceSheets(symbol: string, options?: FundamentalsOptions): Promise<BalanceSheet[]> {
    const stmts = await this.fetchStatements(symbol, options);
    return stmts.map((s) =>
      transformBalanceSheet(s, symbol.toUpperCase(), options?.raw ? s : undefined),
    );
  }

  async cashFlows(symbol: string, options?: FundamentalsOptions): Promise<CashFlowStatement[]> {
    const stmts = await this.fetchStatements(symbol, options);
    return stmts.map((s) =>
      transformCashFlowStatement(s, symbol.toUpperCase(), options?.raw ? s : undefined),
    );
  }

  private async fetchStatements(
    symbol: string,
    options?: FundamentalsOptions,
  ): Promise<TiingoFundamentalsStatement[]> {
    this.limiter.consume();
    const s = normalise(symbol);

    const data = await this.http.get<TiingoFundamentalsStatement[] | TiingoErrorResponse>(
      `/tiingo/fundamentals/${s}/statements`,
    );

    if (!Array.isArray(data)) {
      throw new ProviderError(
        (data as TiingoErrorResponse).detail ?? `No fundamentals data for symbol "${s}"`,
        this.name,
      );
    }

    if (data.length === 0) {
      throw new ProviderError(`No fundamentals data for symbol "${s}"`, this.name);
    }

    // Filter by annual vs quarterly
    const isQuarterly = options?.quarterly ?? false;
    const filtered = data.filter((s) => (isQuarterly ? s.quarter > 0 : s.quarter === 0));

    // Sort most-recent first and apply limit
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const limit = options?.limit ?? 4;
    return filtered.slice(0, limit);
  }

  // ---------------------------------------------------------------------------
  // News
  // ---------------------------------------------------------------------------

  async news(symbol: string, options?: NewsOptions): Promise<NewsItem[]> {
    this.limiter.consume();
    const s = normalise(symbol);
    const limit = options?.limit ?? 10;

    const data = await this.http.get<TiingoNewsArticle[] | TiingoErrorResponse>("/tiingo/news", {
      params: { tickers: s, limit },
    });

    if (!Array.isArray(data)) {
      throw new ProviderError(
        (data as TiingoErrorResponse).detail ?? `No news data for symbol "${s}"`,
        this.name,
      );
    }

    return data
      .slice(0, limit)
      .map((article) => transformNews(article, options?.raw ? article : undefined));
  }
}
