import { ProviderError } from "../../errors.js";
import { HttpClient } from "../../http/client.js";
import type { CompanyOptions, CompanyProfile } from "../../types/company.js";
import type { DividendEvent, DividendOptions } from "../../types/dividends.js";
import type {
  BalanceSheet,
  CashFlowStatement,
  FundamentalsOptions,
  IncomeStatement,
} from "../../types/fundamentals.js";
import type { HistoricalBar, HistoricalOptions } from "../../types/historical.js";
import type { NewsItem, NewsOptions } from "../../types/news.js";
import type { OptionChain, OptionChainOptions } from "../../types/options.js";
import type { MarketProvider } from "../../types/provider.js";
import type { Quote, QuoteOptions } from "../../types/quote.js";
import type { SearchOptions, SearchResult } from "../../types/search.js";
import type { SplitEvent, SplitOptions } from "../../types/splits.js";
import { RateLimiter } from "../../utils/rate-limiter.js";
import { normalise } from "../../utils/symbol.js";
import {
  buildOptionChain,
  transformBalanceSheet,
  transformCashFlowStatement,
  transformCompany,
  transformDividend,
  transformHistoricalBar,
  transformIncomeStatement,
  transformNews,
  transformOptionContract,
  transformQuote,
  transformSearch,
  transformSplit,
} from "./transform.js";
import type {
  PolygonAggregatesResponse,
  PolygonDividendsResponse,
  PolygonFinancialsResponse,
  PolygonNewsResponse,
  PolygonOptionsSnapshotResponse,
  PolygonSnapshotResponse,
  PolygonSplitsResponse,
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
  /** Custom fetch function, e.g. a CORS proxy wrapper for browser use. */
  fetchFn?: typeof globalThis.fetch;
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
      ...(options.fetchFn !== undefined ? { fetchFn: options.fetchFn } : {}),
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
  // Dividends
  // ---------------------------------------------------------------------------
  async dividends(symbol: string, options?: DividendOptions): Promise<DividendEvent[]> {
    this.limiter.consume();

    const s = normalise(symbol);
    const limit = options?.limit ?? 50;
    const params: Record<string, string | number | boolean> = {
      ticker: s,
      limit,
      order: "desc",
      sort: "ex_dividend_date",
      apiKey: this.options.apiKey,
    };
    if (options?.from) params["ex_dividend_date.gte"] = toDateString(new Date(options.from as string));
    if (options?.to) params["ex_dividend_date.lte"] = toDateString(new Date(options.to as string));

    const data = await this.http.get<PolygonDividendsResponse>("/v3/reference/dividends", {
      params,
    });

    this.assertSuccess(data as { status: string; error?: string });

    return (data.results ?? []).map((d) => transformDividend(d, options?.raw ? d : undefined));
  }

  // ---------------------------------------------------------------------------
  // Splits
  // ---------------------------------------------------------------------------
  async splits(symbol: string, options?: SplitOptions): Promise<SplitEvent[]> {
    this.limiter.consume();

    const s = normalise(symbol);
    const limit = options?.limit ?? 50;
    const params: Record<string, string | number | boolean> = {
      ticker: s,
      limit,
      order: "desc",
      sort: "execution_date",
      apiKey: this.options.apiKey,
    };
    if (options?.from) params["execution_date.gte"] = toDateString(new Date(options.from as string));
    if (options?.to) params["execution_date.lte"] = toDateString(new Date(options.to as string));

    const data = await this.http.get<PolygonSplitsResponse>("/v3/reference/splits", {
      params,
    });

    this.assertSuccess(data as { status: string; error?: string });

    return (data.results ?? []).map((s) => transformSplit(s, options?.raw ? s : undefined));
  }

  // ---------------------------------------------------------------------------
  // Options chain
  // ---------------------------------------------------------------------------

  async optionChain(symbol: string, options?: OptionChainOptions): Promise<OptionChain> {
    this.limiter.consume();

    const s = normalise(symbol);
    const limit = options?.limit ?? 50;

    const params: Record<string, string | number | boolean> = {
      limit,
      apiKey: this.options.apiKey,
    };
    if (options?.expiry) params["expiration_date"] = options.expiry;
    if (options?.strike !== undefined) params["strike_price"] = options.strike;
    if (options?.strikeLow !== undefined) params["strike_price.gte"] = options.strikeLow;
    if (options?.strikeHigh !== undefined) params["strike_price.lte"] = options.strikeHigh;
    if (options?.type) params["contract_type"] = options.type;

    const data = await this.http.get<PolygonOptionsSnapshotResponse>(
      `/v3/snapshot/options/${s}`,
      { params },
    );

    this.assertSuccess(data as { status: string; error?: string });

    const contracts = (data.results ?? []).map((snap) =>
      transformOptionContract(snap, s, options?.raw ? snap : undefined),
    );

    return buildOptionChain(contracts, s);
  }

  // ---------------------------------------------------------------------------
  // Fundamentals — income statements, balance sheets, cash flows
  // ---------------------------------------------------------------------------

  async incomeStatements(
    symbol: string,
    options?: FundamentalsOptions,
  ): Promise<IncomeStatement[]> {
    const stmts = await this.fetchFinancials(symbol, options);
    return stmts.map((s) =>
      transformIncomeStatement(s, symbol.toUpperCase(), options?.raw ? s : undefined),
    );
  }

  async balanceSheets(symbol: string, options?: FundamentalsOptions): Promise<BalanceSheet[]> {
    const stmts = await this.fetchFinancials(symbol, options);
    return stmts.map((s) =>
      transformBalanceSheet(s, symbol.toUpperCase(), options?.raw ? s : undefined),
    );
  }

  async cashFlows(
    symbol: string,
    options?: FundamentalsOptions,
  ): Promise<CashFlowStatement[]> {
    const stmts = await this.fetchFinancials(symbol, options);
    return stmts.map((s) =>
      transformCashFlowStatement(s, symbol.toUpperCase(), options?.raw ? s : undefined),
    );
  }

  private async fetchFinancials(
    symbol: string,
    options?: FundamentalsOptions,
  ) {
    this.limiter.consume();

    const s = normalise(symbol);
    const timeframe = options?.quarterly ? "quarterly" : "annual";
    const limit = options?.limit ?? 4;

    const data = await this.http.get<PolygonFinancialsResponse>("/vX/reference/financials", {
      params: {
        ticker: s,
        timeframe,
        limit,
        sort: "period_of_report_date",
        order: "desc",
        apiKey: this.options.apiKey,
      },
    });

    this.assertSuccess(data as { status: string; error?: string });

    if (!data.results || data.results.length === 0) {
      throw new ProviderError(`No financials data for "${s}"`, this.name);
    }

    return data.results;
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
