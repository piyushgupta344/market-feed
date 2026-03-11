import { MemoryCacheDriver } from "./cache/memory.js";
import type { CacheConfig, CacheDriver, CacheMethod } from "./cache/types.js";
import { AllProvidersFailedError, MarketFeedError, UnsupportedOperationError } from "./errors.js";
import { YahooProvider } from "./providers/yahoo/index.js";
import type { CompanyOptions, CompanyProfile } from "./types/company.js";
import type { DividendEvent, DividendOptions } from "./types/dividends.js";
import type { EarningsEvent, EarningsOptions } from "./types/earnings.js";
import type { HistoricalBar, HistoricalOptions } from "./types/historical.js";
import type { MarketStatus, MarketStatusOptions } from "./types/market.js";
import type { NewsItem, NewsOptions } from "./types/news.js";
import type { MarketProvider } from "./types/provider.js";
import type { Quote, QuoteOptions } from "./types/quote.js";
import type { SearchOptions, SearchResult } from "./types/search.js";
import type { SplitEvent, SplitOptions } from "./types/splits.js";

export interface MarketFeedOptions {
  /**
   * Ordered list of provider adapters.
   * When `fallback: true`, each is tried in order until one succeeds.
   * Defaults to `[new YahooProvider()]`.
   */
  providers?: MarketProvider[];
  /**
   * Cache configuration. Pass `false` to disable caching entirely.
   * Defaults to an in-memory LRU cache with 60s TTL.
   */
  cache?: CacheConfig | false;
  /**
   * When `true`, automatically tries the next provider if the current one fails.
   * Defaults to `true`.
   */
  fallback?: boolean;
}

// Default TTLs per method (seconds)
const DEFAULT_TTLS: Record<CacheMethod, number> = {
  quote: 60,
  historical: 3600,
  company: 86400,
  news: 300,
  search: 600,
  marketStatus: 60,
  earnings: 3600,
  dividends: 86400,
  splits: 86400,
};

/**
 * The unified MarketFeed client.
 *
 * Wraps one or more provider adapters under a single consistent API.
 * Handles caching, fallback, and error aggregation transparently.
 *
 * @example
 * ```ts
 * import { MarketFeed } from 'market-feed';
 *
 * const feed = new MarketFeed();
 * const quote = await feed.quote('AAPL');
 * console.log(quote.price); // 189.84
 * ```
 */
export class MarketFeed {
  private readonly _providers: MarketProvider[];
  private readonly cache: CacheDriver | null;
  private readonly fallback: boolean;
  private readonly ttls: Record<CacheMethod, number>;

  /** Read-only view of the configured provider adapters. */
  get providers(): readonly MarketProvider[] {
    return this._providers;
  }

  constructor(options: MarketFeedOptions = {}) {
    this._providers =
      options.providers && options.providers.length > 0 ? options.providers : [new YahooProvider()];

    this.fallback = options.fallback ?? true;

    if (options.cache === false) {
      this.cache = null;
    } else {
      const cfg = options.cache ?? {};
      this.cache = cfg.driver ?? new MemoryCacheDriver(cfg.maxSize ?? 500);
    }

    const overrides = options.cache !== false ? (options.cache?.ttlOverrides ?? {}) : {};
    this.ttls = { ...DEFAULT_TTLS, ...overrides };
  }

  // ---------------------------------------------------------------------------
  // quote
  // ---------------------------------------------------------------------------

  /** Fetch a quote for a single symbol. */
  async quote(symbol: string, options?: QuoteOptions): Promise<Quote>;
  /** Fetch quotes for multiple symbols in parallel. */
  async quote(symbols: string[], options?: QuoteOptions): Promise<Quote[]>;
  async quote(
    symbolOrSymbols: string | string[],
    options?: QuoteOptions,
  ): Promise<Quote | Quote[]> {
    const isSingle = typeof symbolOrSymbols === "string";
    const symbols = isSingle ? [symbolOrSymbols] : symbolOrSymbols;

    const cacheKey = `quote:${symbols.join(",")}`;
    const cached = await this.getCache<Quote[]>(cacheKey);
    if (cached) return isSingle ? (cached[0] as Quote) : cached;

    const result = await this.withFallback("quote", (provider) => provider.quote(symbols, options));

    await this.setCache(cacheKey, result, "quote");
    return isSingle ? (result[0] as Quote) : result;
  }

  // ---------------------------------------------------------------------------
  // historical
  // ---------------------------------------------------------------------------

  async historical(symbol: string, options?: HistoricalOptions): Promise<HistoricalBar[]> {
    const interval = options?.interval ?? "1d";
    const p1 = normaliseDate(options?.period1);
    const p2 = normaliseDate(options?.period2 ?? new Date());
    const cacheKey = `historical:${symbol}:${interval}:${p1}:${p2}`;

    const cached = await this.getCache<HistoricalBar[]>(cacheKey);
    if (cached) return cached;

    const result = await this.withFallback("historical", (provider) =>
      provider.historical(symbol, options),
    );

    await this.setCache(cacheKey, result, "historical");
    return result;
  }

  // ---------------------------------------------------------------------------
  // search
  // ---------------------------------------------------------------------------

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const cacheKey = `search:${query}:${options?.limit ?? 10}`;
    const cached = await this.getCache<SearchResult[]>(cacheKey);
    if (cached) return cached;

    const result = await this.withFallback("search", (provider) => provider.search(query, options));

    await this.setCache(cacheKey, result, "search");
    return result;
  }

  // ---------------------------------------------------------------------------
  // company
  // ---------------------------------------------------------------------------

  async company(symbol: string, options?: CompanyOptions): Promise<CompanyProfile> {
    const cacheKey = `company:${symbol}`;
    const cached = await this.getCache<CompanyProfile>(cacheKey);
    if (cached) return cached;

    const result = await this.withFallback("company", (provider) => {
      if (!provider.company) throw new UnsupportedOperationError(provider.name, "company");
      return provider.company(symbol, options);
    });

    await this.setCache(cacheKey, result, "company");
    return result;
  }

  // ---------------------------------------------------------------------------
  // news
  // ---------------------------------------------------------------------------

  async news(symbol: string, options?: NewsOptions): Promise<NewsItem[]> {
    const cacheKey = `news:${symbol}:${options?.limit ?? 10}`;
    const cached = await this.getCache<NewsItem[]>(cacheKey);
    if (cached) return cached;

    const result = await this.withFallback("news", (provider) => {
      if (!provider.news) throw new UnsupportedOperationError(provider.name, "news");
      return provider.news(symbol, options);
    });

    await this.setCache(cacheKey, result, "news");
    return result;
  }

  // ---------------------------------------------------------------------------
  // marketStatus
  // ---------------------------------------------------------------------------

  async marketStatus(market?: string, options?: MarketStatusOptions): Promise<MarketStatus> {
    const cacheKey = `marketStatus:${market ?? "default"}`;
    const cached = await this.getCache<MarketStatus>(cacheKey);
    if (cached) return cached;

    const result = await this.withFallback("marketStatus", (provider) => {
      if (!provider.marketStatus) {
        throw new UnsupportedOperationError(provider.name, "marketStatus");
      }
      return provider.marketStatus(market, options);
    });

    await this.setCache(cacheKey, result, "marketStatus");
    return result;
  }

  // ---------------------------------------------------------------------------
  // earnings
  // ---------------------------------------------------------------------------

  async earnings(symbol: string, options?: EarningsOptions): Promise<EarningsEvent[]> {
    const limit = options?.limit ?? 10;
    const cacheKey = `earnings:${symbol}:${limit}`;
    const cached = await this.getCache<EarningsEvent[]>(cacheKey);
    if (cached) return cached;

    const result = await this.withFallback("earnings", (provider) => {
      if (!provider.earnings) throw new UnsupportedOperationError(provider.name, "earnings");
      return provider.earnings(symbol, options);
    });

    await this.setCache(cacheKey, result, "earnings");
    return result;
  }

  // ---------------------------------------------------------------------------
  // dividends
  // ---------------------------------------------------------------------------

  async dividends(symbol: string, options?: DividendOptions): Promise<DividendEvent[]> {
    const from = normaliseDate(options?.from);
    const to = normaliseDate(options?.to ?? new Date());
    const cacheKey = `dividends:${symbol}:${from}:${to}`;
    const cached = await this.getCache<DividendEvent[]>(cacheKey);
    if (cached) return cached;

    const result = await this.withFallback("dividends", (provider) => {
      if (!provider.dividends) throw new UnsupportedOperationError(provider.name, "dividends");
      return provider.dividends(symbol, options);
    });

    await this.setCache(cacheKey, result, "dividends");
    return result;
  }

  // ---------------------------------------------------------------------------
  // splits
  // ---------------------------------------------------------------------------

  async splits(symbol: string, options?: SplitOptions): Promise<SplitEvent[]> {
    const from = normaliseDate(options?.from);
    const to = normaliseDate(options?.to ?? new Date());
    const cacheKey = `splits:${symbol}:${from}:${to}`;
    const cached = await this.getCache<SplitEvent[]>(cacheKey);
    if (cached) return cached;

    const result = await this.withFallback("splits", (provider) => {
      if (!provider.splits) throw new UnsupportedOperationError(provider.name, "splits");
      return provider.splits(symbol, options);
    });

    await this.setCache(cacheKey, result, "splits");
    return result;
  }

  // ---------------------------------------------------------------------------
  // Cache management
  // ---------------------------------------------------------------------------

  /** Invalidate all cached entries. */
  async clearCache(): Promise<void> {
    await this.cache?.clear();
  }

  /** Invalidate a specific cache key (exact match). */
  async invalidate(key: string): Promise<void> {
    await this.cache?.delete(key);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async withFallback<T>(
    operation: string,
    fn: (provider: MarketProvider) => Promise<T>,
  ): Promise<T> {
    const errors: MarketFeedError[] = [];

    for (const provider of this._providers) {
      try {
        return await fn(provider);
      } catch (err) {
        if (err instanceof UnsupportedOperationError) {
          if (!this.fallback) throw err;
          errors.push(err);
          continue;
        }
        if (err instanceof MarketFeedError) {
          if (!this.fallback) throw err;
          errors.push(err);
          continue;
        }
        // Unknown error — wrap and rethrow
        throw err;
      }
    }

    throw new AllProvidersFailedError(errors, operation);
  }

  private async getCache<T>(key: string): Promise<T | undefined> {
    if (!this.cache) return undefined;
    return this.cache.get<T>(key);
  }

  private async setCache<T>(key: string, value: T, method: CacheMethod): Promise<void> {
    if (!this.cache) return;
    await this.cache.set(key, value, this.ttls[method]);
  }
}

function normaliseDate(d?: string | Date): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().slice(0, 10);
}
