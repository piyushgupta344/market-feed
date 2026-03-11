import type { CompanyProfile } from "../../types/company.js";
import type { HistoricalBar } from "../../types/historical.js";
import type { Quote } from "../../types/quote.js";
import type { SearchResult } from "../../types/search.js";
import type { AssetType } from "../../types/search.js";
import type { YahooChartResult, YahooQuoteSummaryResult, YahooSearchQuote } from "./types.js";

const PROVIDER = "yahoo";

// ---------------------------------------------------------------------------
// Quote
// ---------------------------------------------------------------------------
export function transformQuote(result: YahooChartResult, raw?: unknown): Quote {
  const meta = result.meta;

  return {
    symbol: meta.symbol,
    name: meta.symbol, // Yahoo chart API doesn't return company name — enriched separately
    price: meta.regularMarketPrice,
    change: meta.regularMarketPrice - meta.regularMarketPreviousClose,
    changePercent:
      ((meta.regularMarketPrice - meta.regularMarketPreviousClose) /
        meta.regularMarketPreviousClose) *
      100,
    open: meta.regularMarketDayHigh, // chart meta has dayHigh/Low not open — see below
    high: meta.regularMarketDayHigh,
    low: meta.regularMarketDayLow,
    close: meta.regularMarketPrice,
    previousClose: meta.regularMarketPreviousClose,
    volume: meta.regularMarketVolume,
    ...(meta.fiftyTwoWeekHigh !== undefined ? { fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh } : {}),
    ...(meta.fiftyTwoWeekLow !== undefined ? { fiftyTwoWeekLow: meta.fiftyTwoWeekLow } : {}),
    currency: meta.currency,
    exchange: meta.fullExchangeName ?? meta.exchangeName,
    timestamp: new Date(meta.regularMarketTime * 1_000),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

// ---------------------------------------------------------------------------
// Historical bars
// ---------------------------------------------------------------------------
export function transformHistorical(result: YahooChartResult, raw?: unknown): HistoricalBar[] {
  const timestamps = result.timestamp ?? [];
  const quoteIndicators = result.indicators.quote[0];
  const adjCloseIndicators = result.indicators.adjclose?.[0];

  if (!quoteIndicators) return [];

  return timestamps
    .map((ts, i) => {
      const open = quoteIndicators.open[i];
      const high = quoteIndicators.high[i];
      const low = quoteIndicators.low[i];
      const close = quoteIndicators.close[i];
      const volume = quoteIndicators.volume[i];
      const adjClose = adjCloseIndicators?.adjclose[i];

      // Skip bars with null/undefined OHLCV (Yahoo returns nulls for non-trading days)
      // Using == null to catch both null and undefined (noUncheckedIndexedAccess)
      if (open == null || high == null || low == null || close == null || volume == null) {
        return null;
      }

      const bar: HistoricalBar = {
        date: new Date(ts * 1_000),
        open,
        high,
        low,
        close,
        volume,
        ...(adjClose !== null && adjClose !== undefined ? { adjClose } : {}),
        ...(raw !== undefined ? { raw } : {}),
      };

      return bar;
    })
    .filter((bar): bar is HistoricalBar => bar !== null);
}

// ---------------------------------------------------------------------------
// Company profile
// ---------------------------------------------------------------------------
export function transformCompany(
  symbol: string,
  result: YahooQuoteSummaryResult,
  raw?: unknown,
): CompanyProfile {
  const profile = result.assetProfile;
  const summary = result.summaryDetail;
  const price = result.price;

  const officers = profile?.companyOfficers ?? [];
  const ceo = officers.find((o) => (o.title ?? "").toLowerCase().includes("chief executive"))?.name;

  return {
    symbol,
    name: price?.longName ?? price?.shortName ?? symbol,
    ...(profile?.longBusinessSummary !== undefined
      ? { description: profile.longBusinessSummary }
      : {}),
    ...(profile?.sector !== undefined ? { sector: profile.sector } : {}),
    ...(profile?.industry !== undefined ? { industry: profile.industry } : {}),
    ...(profile?.country !== undefined ? { country: profile.country } : {}),
    ...(profile?.fullTimeEmployees !== undefined ? { employees: profile.fullTimeEmployees } : {}),
    ...(profile?.website !== undefined ? { website: profile.website } : {}),
    ...(ceo !== undefined ? { ceo } : {}),
    ...(summary?.marketCap?.raw !== undefined ? { marketCap: summary.marketCap.raw } : {}),
    ...(summary?.trailingPE?.raw !== undefined ? { peRatio: summary.trailingPE.raw } : {}),
    ...(summary?.forwardPE?.raw !== undefined ? { forwardPE: summary.forwardPE.raw } : {}),
    ...(summary?.priceToBook?.raw !== undefined ? { priceToBook: summary.priceToBook.raw } : {}),
    ...(summary?.dividendYield?.raw !== undefined
      ? { dividendYield: summary.dividendYield.raw }
      : {}),
    ...(summary?.beta?.raw !== undefined ? { beta: summary.beta.raw } : {}),
    ...(price?.exchangeName !== undefined ? { exchange: price.exchangeName } : {}),
    ...(price?.currency !== undefined
      ? { currency: price.currency }
      : summary?.currency !== undefined
        ? { currency: summary.currency }
        : {}),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
const YAHOO_TYPE_MAP: Record<string, AssetType> = {
  EQUITY: "stock",
  ETF: "etf",
  CRYPTOCURRENCY: "crypto",
  CURRENCY: "forex",
  INDEX: "index",
  MUTUALFUND: "mutual-fund",
  FUTURE: "future",
};

export function transformSearch(quote: YahooSearchQuote, raw?: unknown): SearchResult {
  const exchange = quote.exchDisp ?? quote.exchange;
  return {
    symbol: quote.symbol,
    name: quote.longname ?? quote.shortname ?? quote.symbol,
    type: YAHOO_TYPE_MAP[quote.quoteType?.toUpperCase() ?? ""] ?? "unknown",
    ...(exchange !== undefined ? { exchange } : {}),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}
