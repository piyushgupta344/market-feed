/**
 * Raw response shapes from the Yahoo Finance v8 chart API and related endpoints.
 * These are intentionally typed as `unknown`-safe so transforms can guard properly.
 */

export interface YahooChartResponse {
  chart: {
    result: YahooChartResult[] | null;
    error: YahooError | null;
  };
}

export interface YahooChartResult {
  meta: YahooChartMeta;
  timestamp?: number[];
  indicators: {
    quote: YahooQuoteIndicator[];
    adjclose?: YahooAdjCloseIndicator[];
  };
}

export interface YahooChartMeta {
  currency: string;
  symbol: string;
  exchangeName: string;
  fullExchangeName?: string;
  instrumentType: string;
  firstTradeDate: number | null;
  regularMarketTime: number;
  hasPrePostMarketData: boolean;
  gmtoffset: number;
  timezone: string;
  exchangeTimezoneName: string;
  regularMarketPrice: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  regularMarketVolume: number;
  regularMarketPreviousClose: number;
  chartPreviousClose?: number;
  priceHint: number;
  currentTradingPeriod: {
    pre: YahooTradingPeriod;
    regular: YahooTradingPeriod;
    post: YahooTradingPeriod;
  };
  dataGranularity: string;
  range: string;
  validRanges: string[];
}

export interface YahooTradingPeriod {
  timezone: string;
  start: number;
  end: number;
  gmtoffset: number;
}

export interface YahooQuoteIndicator {
  open: (number | null)[];
  high: (number | null)[];
  low: (number | null)[];
  close: (number | null)[];
  volume: (number | null)[];
}

export interface YahooAdjCloseIndicator {
  adjclose: (number | null)[];
}

// ---------------------------------------------------------------------------
// Quote summary (for company profile)
// ---------------------------------------------------------------------------
export interface YahooQuoteSummaryResponse {
  quoteSummary: {
    result: YahooQuoteSummaryResult[] | null;
    error: YahooError | null;
  };
}

export interface YahooQuoteSummaryResult {
  assetProfile?: YahooAssetProfile;
  summaryDetail?: YahooSummaryDetail;
  price?: YahooPriceModule;
}

export interface YahooAssetProfile {
  longBusinessSummary?: string;
  sector?: string;
  industry?: string;
  country?: string;
  fullTimeEmployees?: number;
  website?: string;
  companyOfficers?: Array<{ name?: string; title?: string }>;
}

export interface YahooSummaryDetail {
  currency?: string;
  marketCap?: { raw?: number };
  trailingPE?: { raw?: number };
  forwardPE?: { raw?: number };
  priceToBook?: { raw?: number };
  dividendYield?: { raw?: number };
  beta?: { raw?: number };
}

export interface YahooPriceModule {
  longName?: string;
  shortName?: string;
  symbol?: string;
  exchangeName?: string;
  currency?: string;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
export interface YahooSearchResponse {
  quotes: YahooSearchQuote[];
  news?: unknown[];
}

export interface YahooSearchQuote {
  symbol: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  exchange?: string;
  exchDisp?: string;
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------
export interface YahooError {
  code: string;
  description: string;
}
