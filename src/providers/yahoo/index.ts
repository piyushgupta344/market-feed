import { ProviderError } from "../../errors.js";
import { HttpClient } from "../../http/client.js";
import type { CompanyOptions, CompanyProfile } from "../../types/company.js";
import type { DividendEvent, DividendOptions } from "../../types/dividends.js";
import type { EarningsEvent, EarningsOptions } from "../../types/earnings.js";
import type { HistoricalBar, HistoricalOptions } from "../../types/historical.js";
import type { MarketProvider } from "../../types/provider.js";
import type { Quote, QuoteOptions } from "../../types/quote.js";
import type { SearchOptions, SearchResult } from "../../types/search.js";
import type { SplitEvent, SplitOptions } from "../../types/splits.js";
import { toYahooSymbol } from "../../utils/symbol.js";
import {
  transformCompany,
  transformDividends,
  transformEarnings,
  transformHistorical,
  transformQuote,
  transformSearch,
  transformSplits,
} from "./transform.js";
import type {
  YahooChartResponse,
  YahooQuoteSummaryResponse,
  YahooSearchResponse,
} from "./types.js";

export interface YahooProviderOptions {
  /** Request timeout in milliseconds. Defaults to 10 000. */
  timeoutMs?: number;
  /** Retry attempts on transient failures. Defaults to 2. */
  retries?: number;
}

/**
 * Yahoo Finance provider — no API key required.
 *
 * Uses the unofficial Yahoo Finance v8 chart API, which is free and publicly
 * accessible but not officially supported. Use respectfully.
 */
export class YahooProvider implements MarketProvider {
  readonly name = "yahoo";

  private readonly http1: HttpClient;
  private readonly http2: HttpClient;

  constructor(options: YahooProviderOptions = {}) {
    const shared = {
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
      ...(options.retries !== undefined ? { retries: options.retries } : {}),
      headers: {
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
      },
    };
    this.http1 = new HttpClient("yahoo", {
      ...shared,
      baseUrl: "https://query1.finance.yahoo.com",
    });
    this.http2 = new HttpClient("yahoo", {
      ...shared,
      baseUrl: "https://query2.finance.yahoo.com",
    });
  }

  // ---------------------------------------------------------------------------
  // Quote
  // ---------------------------------------------------------------------------
  async quote(symbols: string[], options?: QuoteOptions): Promise<Quote[]> {
    const results = await Promise.all(
      symbols.map((symbol) => this.fetchSingleQuote(symbol, options)),
    );
    return results;
  }

  private async fetchSingleQuote(symbol: string, options?: QuoteOptions): Promise<Quote> {
    const s = toYahooSymbol(symbol);
    const data = await this.http1.get<YahooChartResponse>(`/v8/finance/chart/${s}`, {
      params: {
        interval: "1d",
        range: "1d",
        includePrePost: false,
      },
    });

    const result = data.chart.result?.[0];
    if (!result) {
      const err = data.chart.error;
      throw new ProviderError(err?.description ?? `No data returned for symbol "${s}"`, this.name);
    }

    return transformQuote(result, options?.raw ? data : undefined);
  }

  // ---------------------------------------------------------------------------
  // Historical
  // ---------------------------------------------------------------------------
  async historical(symbol: string, options?: HistoricalOptions): Promise<HistoricalBar[]> {
    const s = toYahooSymbol(symbol);
    const interval = options?.interval ?? "1d";

    const period1 = toEpoch(options?.period1 ?? subtractOneYear());
    const period2 = toEpoch(options?.period2 ?? new Date());

    const data = await this.http1.get<YahooChartResponse>(`/v8/finance/chart/${s}`, {
      params: {
        interval,
        period1,
        period2,
        events: "div,splits",
        includeAdjustedClose: true,
      },
    });

    const result = data.chart.result?.[0];
    if (!result) {
      const err = data.chart.error;
      throw new ProviderError(
        err?.description ?? `No historical data for symbol "${s}"`,
        this.name,
      );
    }

    return transformHistorical(result, options?.raw ? data : undefined);
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const limit = options?.limit ?? 10;

    const data = await this.http1.get<YahooSearchResponse>("/v1/finance/search", {
      params: {
        q: query,
        quotesCount: limit,
        newsCount: 0,
        enableFuzzyQuery: false,
        enableEnhancedTrivialQuery: true,
      },
    });

    return (data.quotes ?? [])
      .slice(0, limit)
      .map((q) => transformSearch(q, options?.raw ? q : undefined));
  }

  // ---------------------------------------------------------------------------
  // Company
  // ---------------------------------------------------------------------------
  async company(symbol: string, options?: CompanyOptions): Promise<CompanyProfile> {
    const s = toYahooSymbol(symbol);

    const data = await this.http2.get<YahooQuoteSummaryResponse>(`/v10/finance/quoteSummary/${s}`, {
      params: {
        modules: "assetProfile,summaryDetail,price",
      },
    });

    const result = data.quoteSummary.result?.[0];
    if (!result) {
      const err = data.quoteSummary.error;
      throw new ProviderError(err?.description ?? `No company data for symbol "${s}"`, this.name);
    }

    return transformCompany(symbol, result, options?.raw ? data : undefined);
  }

  // ---------------------------------------------------------------------------
  // Earnings
  // ---------------------------------------------------------------------------
  async earnings(symbol: string, options?: EarningsOptions): Promise<EarningsEvent[]> {
    const s = toYahooSymbol(symbol);
    const limit = options?.limit ?? 10;

    const data = await this.http2.get<YahooQuoteSummaryResponse>(`/v10/finance/quoteSummary/${s}`, {
      params: { modules: "earningsHistory" },
    });

    const result = data.quoteSummary.result?.[0];
    if (!result) {
      const err = data.quoteSummary.error;
      throw new ProviderError(
        err?.description ?? `No earnings data for symbol "${s}"`,
        this.name,
      );
    }

    return transformEarnings(symbol, result, options?.raw ? data : undefined).slice(0, limit);
  }

  // ---------------------------------------------------------------------------
  // Dividends
  // ---------------------------------------------------------------------------
  async dividends(symbol: string, options?: DividendOptions): Promise<DividendEvent[]> {
    const s = toYahooSymbol(symbol);
    const limit = options?.limit ?? 50;

    const period1 = options?.from ? toEpoch(options.from) : toEpoch(subtractYears(10));
    const period2 = options?.to ? toEpoch(options.to) : toEpoch(new Date());

    const data = await this.http1.get<YahooChartResponse>(`/v8/finance/chart/${s}`, {
      params: { interval: "1d", period1, period2, events: "div" },
    });

    const result = data.chart.result?.[0];
    if (!result) {
      const err = data.chart.error;
      throw new ProviderError(
        err?.description ?? `No dividend data for symbol "${s}"`,
        this.name,
      );
    }

    return transformDividends(symbol, result, options?.raw ? data : undefined).slice(0, limit);
  }

  // ---------------------------------------------------------------------------
  // Splits
  // ---------------------------------------------------------------------------
  async splits(symbol: string, options?: SplitOptions): Promise<SplitEvent[]> {
    const s = toYahooSymbol(symbol);
    const limit = options?.limit ?? 50;

    const period1 = options?.from ? toEpoch(options.from) : toEpoch(subtractYears(10));
    const period2 = options?.to ? toEpoch(options.to) : toEpoch(new Date());

    const data = await this.http1.get<YahooChartResponse>(`/v8/finance/chart/${s}`, {
      params: { interval: "1d", period1, period2, events: "split" },
    });

    const result = data.chart.result?.[0];
    if (!result) {
      const err = data.chart.error;
      throw new ProviderError(
        err?.description ?? `No split data for symbol "${s}"`,
        this.name,
      );
    }

    return transformSplits(symbol, result, options?.raw ? data : undefined).slice(0, limit);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function toEpoch(date: string | Date): number {
  const d = date instanceof Date ? date : new Date(date);
  return Math.floor(d.getTime() / 1_000);
}

function subtractOneYear(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d;
}

function subtractYears(n: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d;
}
