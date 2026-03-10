import type { CompanyOptions, CompanyProfile } from "./company.js";
import type { HistoricalBar, HistoricalOptions } from "./historical.js";
import type { MarketStatus, MarketStatusOptions } from "./market.js";
import type { NewsItem, NewsOptions } from "./news.js";
import type { Quote, QuoteOptions } from "./quote.js";
import type { SearchOptions, SearchResult } from "./search.js";

/**
 * The contract every provider adapter must satisfy.
 *
 * Methods marked optional (`?`) are not supported by all free-tier APIs.
 * The MarketFeed client only calls them when the active provider declares them.
 */
export interface MarketProvider {
  /** Human-readable provider name, e.g. "yahoo" */
  readonly name: string;

  /**
   * Fetch real-time (or latest delayed) quotes for one or more symbols.
   * Always returns an array — callers slice as needed.
   */
  quote(symbols: string[], options?: QuoteOptions): Promise<Quote[]>;

  /**
   * Fetch OHLCV bars for a single symbol over a date range.
   */
  historical(symbol: string, options?: HistoricalOptions): Promise<HistoricalBar[]>;

  /**
   * Search for tickers matching a query string.
   */
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;

  /**
   * Fetch company/asset profile. Optional — not all providers support this.
   */
  company?(symbol: string, options?: CompanyOptions): Promise<CompanyProfile>;

  /**
   * Fetch recent news for a symbol. Optional.
   */
  news?(symbol: string, options?: NewsOptions): Promise<NewsItem[]>;

  /**
   * Return current market status for a given market identifier (e.g. "US").
   * Optional.
   */
  marketStatus?(market?: string, options?: MarketStatusOptions): Promise<MarketStatus>;
}
