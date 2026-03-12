import { ProviderError } from "../../errors.js";
import { HttpClient } from "../../http/client.js";
import type { CompanyOptions, CompanyProfile } from "../../types/company.js";
import type { BalanceSheet, CashFlowStatement, FundamentalsOptions, IncomeStatement } from "../../types/fundamentals.js";
import type { HistoricalBar, HistoricalOptions } from "../../types/historical.js";
import type { MarketProvider } from "../../types/provider.js";
import type { Quote, QuoteOptions } from "../../types/quote.js";
import type { SearchOptions, SearchResult } from "../../types/search.js";
import { RateLimiter } from "../../utils/rate-limiter.js";
import { normalise } from "../../utils/symbol.js";
import {
  transformBalanceSheet,
  transformCashFlowStatement,
  transformHistoricalBar,
  transformIncomeStatement,
  transformProfile,
  transformQuote,
  transformSearch,
} from "./transform.js";
import type {
  TwelveDataBalanceSheetResponse,
  TwelveDataCashFlowResponse,
  TwelveDataIncomeStatementResponse,
  TwelveDataProfileResponse,
  TwelveDataQuoteResponse,
  TwelveDataSearchResponse,
  TwelveDataTimeSeriesResponse,
} from "./types.js";

export interface TwelveDataProviderOptions {
  apiKey: string;
  /** Request timeout in milliseconds. Defaults to 10 000. */
  timeoutMs?: number;
  /** Retry attempts on transient failures. Defaults to 2. */
  retries?: number;
  /**
   * Override the default rate limiter.
   * Free tier: 8 API calls/minute.
   */
  rateLimiter?: RateLimiter;
}

/**
 * Twelve Data provider.
 *
 * Free tier provides 800 API credits/day and 8 API calls/minute.
 * Strong coverage for US/global equities, forex, and crypto.
 * API key required — sign up free at https://twelvedata.com
 */
export class TwelveDataProvider implements MarketProvider {
  readonly name = "twelve-data";

  private readonly http: HttpClient;
  private readonly limiter: RateLimiter;
  private readonly apiKey: string;

  constructor(private readonly options: TwelveDataProviderOptions) {
    this.apiKey = options.apiKey;
    this.http = new HttpClient("twelve-data", {
      baseUrl: "https://api.twelvedata.com",
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
      ...(options.retries !== undefined ? { retries: options.retries } : {}),
    });
    // Free tier: 8 calls/minute ≈ 0.1333 tokens/second
    this.limiter = options.rateLimiter ?? new RateLimiter("twelve-data", 8, 8 / 60);
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

    const data = await this.http.get<TwelveDataQuoteResponse>("/quote", {
      params: { symbol: s, apikey: this.apiKey },
    });

    if (data.code !== undefined) {
      throw new ProviderError(
        data.message ?? `No quote data for symbol "${s}"`,
        this.name,
        data.code,
      );
    }

    return transformQuote(data, options?.raw ? data : undefined);
  }

  // ---------------------------------------------------------------------------
  // Historical (time series)
  // ---------------------------------------------------------------------------

  async historical(symbol: string, options?: HistoricalOptions): Promise<HistoricalBar[]> {
    this.limiter.consume();
    const s = normalise(symbol);
    const interval = toInterval(options?.interval ?? "1d");

    const params: Record<string, string | number | boolean | undefined> = {
      symbol: s,
      interval,
      outputsize: 5000,
      apikey: this.apiKey,
    };

    if (options?.period1 !== undefined) {
      params["start_date"] =
        typeof options.period1 === "string"
          ? options.period1
          : options.period1.toISOString().slice(0, 10);
    }
    if (options?.period2 !== undefined) {
      params["end_date"] =
        typeof options.period2 === "string"
          ? options.period2
          : options.period2.toISOString().slice(0, 10);
    }

    const data = await this.http.get<TwelveDataTimeSeriesResponse>("/time_series", { params });

    if (data.code !== undefined || data.status === "error") {
      throw new ProviderError(
        data.message ?? `No historical data for symbol "${s}"`,
        this.name,
        data.code,
      );
    }

    if (!Array.isArray(data.values) || data.values.length === 0) {
      throw new ProviderError(`No historical data for symbol "${s}"`, this.name);
    }

    // Twelve Data returns newest-first; reverse to chronological order
    return [...data.values]
      .reverse()
      .map((bar) => transformHistoricalBar(bar, options?.raw ? bar : undefined));
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    this.limiter.consume();
    const limit = options?.limit ?? 10;

    const data = await this.http.get<TwelveDataSearchResponse>("/symbol_search", {
      params: { symbol: query, apikey: this.apiKey },
    });

    if (data.code !== undefined || data.status === "error") {
      return [];
    }

    return (data.data ?? [])
      .slice(0, limit)
      .map((r) => transformSearch(r, options?.raw ? r : undefined));
  }

  // ---------------------------------------------------------------------------
  // Company (profile)
  // ---------------------------------------------------------------------------

  async company(symbol: string, options?: CompanyOptions): Promise<CompanyProfile> {
    this.limiter.consume();
    const s = normalise(symbol);

    const data = await this.http.get<TwelveDataProfileResponse>("/profile", {
      params: { symbol: s, apikey: this.apiKey },
    });

    if (data.code !== undefined || !data.name) {
      throw new ProviderError(
        data.message ?? `No company data for symbol "${s}"`,
        this.name,
        data.code,
      );
    }

    return transformProfile(data, options?.raw ? data : undefined);
  }

  // ---------------------------------------------------------------------------
  // Fundamentals
  // ---------------------------------------------------------------------------

  async incomeStatements(symbol: string, options?: FundamentalsOptions): Promise<IncomeStatement[]> {
    this.limiter.consume();
    const s = normalise(symbol);

    const data = await this.http.get<TwelveDataIncomeStatementResponse>("/income_statement", {
      params: { symbol: s, apikey: this.apiKey },
    });

    if (data.code !== undefined) {
      throw new ProviderError(
        data.message ?? `No income statement data for symbol "${s}"`,
        this.name,
        data.code,
      );
    }

    const periodType = options?.quarterly ? "quarterly" : "annual";
    const periods = (options?.quarterly
      ? data.income_statement?.quarterly
      : data.income_statement?.annual) ?? [];

    if (periods.length === 0) {
      throw new ProviderError(`No income statement data for symbol "${s}"`, this.name);
    }

    const limit = options?.limit ?? periods.length;
    return periods
      .slice(0, limit)
      .map((p) => transformIncomeStatement(p, s, periodType, options?.raw ? p : undefined));
  }

  async balanceSheets(symbol: string, options?: FundamentalsOptions): Promise<BalanceSheet[]> {
    this.limiter.consume();
    const s = normalise(symbol);

    const data = await this.http.get<TwelveDataBalanceSheetResponse>("/balance_sheet", {
      params: { symbol: s, apikey: this.apiKey },
    });

    if (data.code !== undefined) {
      throw new ProviderError(
        data.message ?? `No balance sheet data for symbol "${s}"`,
        this.name,
        data.code,
      );
    }

    const periodType = options?.quarterly ? "quarterly" : "annual";
    const periods = (options?.quarterly
      ? data.balance_sheet?.quarterly
      : data.balance_sheet?.annual) ?? [];

    if (periods.length === 0) {
      throw new ProviderError(`No balance sheet data for symbol "${s}"`, this.name);
    }

    const limit = options?.limit ?? periods.length;
    return periods
      .slice(0, limit)
      .map((p) => transformBalanceSheet(p, s, periodType, options?.raw ? p : undefined));
  }

  async cashFlows(symbol: string, options?: FundamentalsOptions): Promise<CashFlowStatement[]> {
    this.limiter.consume();
    const s = normalise(symbol);

    const data = await this.http.get<TwelveDataCashFlowResponse>("/cash_flow_statement", {
      params: { symbol: s, apikey: this.apiKey },
    });

    if (data.code !== undefined) {
      throw new ProviderError(
        data.message ?? `No cash flow data for symbol "${s}"`,
        this.name,
        data.code,
      );
    }

    const periodType = options?.quarterly ? "quarterly" : "annual";
    const periods = (options?.quarterly
      ? data.cash_flow_statement?.quarterly
      : data.cash_flow_statement?.annual) ?? [];

    if (periods.length === 0) {
      throw new ProviderError(`No cash flow data for symbol "${s}"`, this.name);
    }

    const limit = options?.limit ?? periods.length;
    return periods
      .slice(0, limit)
      .map((p) => transformCashFlowStatement(p, s, periodType, options?.raw ? p : undefined));
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toInterval(interval: string): string {
  const map: Record<string, string> = {
    "1m": "1min",
    "2m": "2min",
    "5m": "5min",
    "15m": "15min",
    "30m": "30min",
    "45m": "45min",
    "60m": "1h",
    "90m": "90min",
    "1h": "1h",
    "2h": "2h",
    "4h": "4h",
    "1d": "1day",
    "5d": "1week",
    "1wk": "1week",
    "1mo": "1month",
    "3mo": "3month",
  };
  return map[interval] ?? "1day";
}
