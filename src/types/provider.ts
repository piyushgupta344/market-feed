import type { CompanyOptions, CompanyProfile } from "./company.js";
import type { DividendEvent, DividendOptions } from "./dividends.js";
import type { EarningsEvent, EarningsOptions } from "./earnings.js";
import type {
  BalanceSheet,
  CashFlowStatement,
  FundamentalsOptions,
  IncomeStatement,
} from "./fundamentals.js";
import type { HistoricalBar, HistoricalOptions } from "./historical.js";
import type { MarketStatus, MarketStatusOptions } from "./market.js";
import type { NewsItem, NewsOptions } from "./news.js";
import type { OptionChain, OptionChainOptions } from "./options.js";
import type { Quote, QuoteOptions } from "./quote.js";
import type { SearchOptions, SearchResult } from "./search.js";
import type { SplitEvent, SplitOptions } from "./splits.js";

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

  /**
   * Fetch historical earnings (EPS actuals vs. estimates). Optional.
   */
  earnings?(symbol: string, options?: EarningsOptions): Promise<EarningsEvent[]>;

  /**
   * Fetch historical cash dividends. Optional.
   */
  dividends?(symbol: string, options?: DividendOptions): Promise<DividendEvent[]>;

  /**
   * Fetch historical stock splits. Optional.
   */
  splits?(symbol: string, options?: SplitOptions): Promise<SplitEvent[]>;

  /**
   * Fetch historical income statements (annual or quarterly). Optional.
   */
  incomeStatements?(symbol: string, options?: FundamentalsOptions): Promise<IncomeStatement[]>;

  /**
   * Fetch historical balance sheets (annual or quarterly). Optional.
   */
  balanceSheets?(symbol: string, options?: FundamentalsOptions): Promise<BalanceSheet[]>;

  /**
   * Fetch historical cash flow statements (annual or quarterly). Optional.
   */
  cashFlows?(symbol: string, options?: FundamentalsOptions): Promise<CashFlowStatement[]>;

  /**
   * Fetch an options chain for a symbol. Optional.
   */
  optionChain?(symbol: string, options?: OptionChainOptions): Promise<OptionChain>;
}
