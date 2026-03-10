import type { CompanyProfile } from "../../types/company.js";
import type { HistoricalBar } from "../../types/historical.js";
import type { NewsItem } from "../../types/news.js";
import type { Quote } from "../../types/quote.js";
import type { AssetType, SearchResult } from "../../types/search.js";
import type {
  PolygonAggBar,
  PolygonNewsArticle,
  PolygonSnapshotTicker,
  PolygonTicker,
  PolygonTickerDetails,
} from "./types.js";

const PROVIDER = "polygon";

// ---------------------------------------------------------------------------
// Quote
// ---------------------------------------------------------------------------
export function transformQuote(ticker: PolygonSnapshotTicker, raw?: unknown): Quote {
  const day = ticker.day;
  const prev = ticker.prevDay;
  const price = ticker.lastTrade?.p ?? day.c;

  return {
    symbol: ticker.ticker,
    name: ticker.ticker,
    price,
    change: ticker.todaysChange,
    changePercent: ticker.todaysChangePerc,
    open: day.o,
    high: day.h,
    low: day.l,
    close: day.c,
    previousClose: prev.c,
    volume: day.v,
    currency: "USD",
    exchange: "",
    timestamp: new Date(ticker.updated / 1_000_000), // nanoseconds → ms
    provider: PROVIDER,
    raw,
  };
}

// ---------------------------------------------------------------------------
// Historical bars
// ---------------------------------------------------------------------------
export function transformHistoricalBar(bar: PolygonAggBar, raw?: unknown): HistoricalBar {
  return {
    date: new Date(bar.t),
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
    ...(raw !== undefined ? { raw } : {}),
  };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
const POLYGON_TYPE_MAP: Record<string, AssetType> = {
  CS: "stock",
  ETF: "etf",
  ETN: "etf",
  ETP: "etf",
  CRYPTO: "crypto",
  FX: "forex",
  CURRENCY: "forex",
  INDEX: "index",
  MF: "mutual-fund",
  FUND: "mutual-fund",
  WARRANT: "unknown",
  RIGHT: "unknown",
  ADRC: "stock",
  PFD: "stock",
};

export function transformSearch(ticker: PolygonTicker, raw?: unknown): SearchResult {
  const type = ticker.type ? (POLYGON_TYPE_MAP[ticker.type.toUpperCase()] ?? "unknown") : "unknown";
  return {
    symbol: ticker.ticker,
    name: ticker.name,
    type,
    ...(ticker.primary_exchange ? { exchange: ticker.primary_exchange } : {}),
    ...(ticker.currency_name ? { currency: ticker.currency_name.toUpperCase() } : {}),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

// ---------------------------------------------------------------------------
// Company profile
// ---------------------------------------------------------------------------
export function transformCompany(details: PolygonTickerDetails, raw?: unknown): CompanyProfile {
  return {
    symbol: details.ticker,
    name: details.name,
    ...(details.description ? { description: details.description } : {}),
    ...(details.sic_description ? { sector: details.sic_description } : {}),
    ...(details.address?.country ? { country: details.address.country } : {}),
    ...(details.total_employees !== undefined ? { employees: details.total_employees } : {}),
    ...(details.homepage_url ? { website: details.homepage_url } : {}),
    ...(details.market_cap !== undefined ? { marketCap: details.market_cap } : {}),
    ...(details.primary_exchange ? { exchange: details.primary_exchange } : {}),
    ...(details.list_date ? { ipoDate: new Date(details.list_date) } : {}),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

// ---------------------------------------------------------------------------
// News
// ---------------------------------------------------------------------------
export function transformNews(article: PolygonNewsArticle, raw?: unknown): NewsItem {
  return {
    id: article.id,
    title: article.title,
    ...(article.description ? { summary: article.description } : {}),
    url: article.article_url,
    source: article.publisher?.name ?? "unknown",
    publishedAt: new Date(article.published_utc),
    symbols: article.tickers ?? [],
    ...(article.image_url ? { thumbnail: article.image_url } : {}),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}
