// Main client
export { MarketFeed } from "./client.js";
export type { MarketFeedOptions } from "./client.js";

// Providers
export { YahooProvider } from "./providers/yahoo/index.js";
export type { YahooProviderOptions } from "./providers/yahoo/index.js";

export { AlphaVantageProvider } from "./providers/alpha-vantage/index.js";
export type { AlphaVantageProviderOptions } from "./providers/alpha-vantage/index.js";

export { PolygonProvider } from "./providers/polygon/index.js";
export type { PolygonProviderOptions } from "./providers/polygon/index.js";

export { FinnhubProvider } from "./providers/finnhub/index.js";
export type { FinnhubProviderOptions } from "./providers/finnhub/index.js";

export { TwelveDataProvider } from "./providers/twelve-data/index.js";
export type { TwelveDataProviderOptions } from "./providers/twelve-data/index.js";

// Cache
export { MemoryCacheDriver } from "./cache/memory.js";
export type { CacheConfig, CacheDriver, CacheMethod } from "./cache/types.js";

// Errors
export {
  AllProvidersFailedError,
  MarketFeedError,
  ProviderError,
  RateLimitError,
  UnsupportedOperationError,
} from "./errors.js";

// Types
export type {
  AssetType,
  CompanyOptions,
  CompanyProfile,
  DividendEvent,
  DividendFrequency,
  DividendOptions,
  EarningsEvent,
  EarningsOptions,
  HistoricalBar,
  HistoricalInterval,
  HistoricalOptions,
  MarketProvider,
  MarketStatus,
  MarketStatusOptions,
  NewsItem,
  NewsOptions,
  Quote,
  QuoteOptions,
  SearchOptions,
  SearchResult,
  SplitEvent,
  SplitOptions,
  TradingSession,
} from "./types/index.js";

// Utilities (useful for custom provider implementations)
export {
  dedupeSymbols,
  isCrypto,
  isForex,
  normalise,
  stripExchange,
  toAlphaVantageSymbol,
  toFinnhubSymbol,
  toPolygonSymbol,
  toTwelveDataSymbol,
  toYahooSymbol,
} from "./utils/symbol.js";
export { RateLimiter } from "./utils/rate-limiter.js";
