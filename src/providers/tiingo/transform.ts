import type { CompanyProfile } from "../../types/company.js";
import type { HistoricalBar } from "../../types/historical.js";
import type { NewsItem } from "../../types/news.js";
import type { Quote } from "../../types/quote.js";
import type { SearchResult } from "../../types/search.js";
import type {
  TiingoDailyBar,
  TiingoIexQuote,
  TiingoMetaResponse,
  TiingoNewsArticle,
  TiingoSearchResultItem,
} from "./types.js";

const PROVIDER = "tiingo";

export function transformQuote(
  iex: TiingoIexQuote,
  meta?: TiingoMetaResponse,
  raw?: unknown,
): Quote {
  const price = iex.last ?? iex.tngoLast;
  const prevClose = iex.prevClose;
  const change = price - prevClose;
  const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

  return {
    symbol: iex.ticker.toUpperCase(),
    name: meta?.name ?? iex.ticker.toUpperCase(),
    price,
    change,
    changePercent,
    open: iex.open ?? price,
    high: iex.high ?? price,
    low: iex.low ?? price,
    close: price,
    previousClose: prevClose,
    volume: iex.volume,
    currency: "USD",
    exchange: meta?.exchangeCode ?? "",
    timestamp: new Date(iex.timestamp),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

export function transformHistoricalBar(bar: TiingoDailyBar, raw?: unknown): HistoricalBar {
  return {
    date: new Date(bar.date),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    adjClose: bar.adjClose,
    volume: bar.volume,
    ...(raw !== undefined ? { raw } : {}),
  };
}

export function transformSearch(item: TiingoSearchResultItem, raw?: unknown): SearchResult {
  return {
    symbol: item.ticker.toUpperCase(),
    name: item.name,
    type: mapAssetType(item.assetType),
    exchange: item.exchangeCode || undefined,
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

export function transformCompany(
  meta: TiingoMetaResponse,
  raw?: unknown,
): CompanyProfile {
  return {
    symbol: meta.ticker.toUpperCase(),
    name: meta.name,
    description: meta.description || undefined,
    exchange: meta.exchangeCode || undefined,
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

export function transformNews(article: TiingoNewsArticle, raw?: unknown): NewsItem {
  return {
    id: String(article.id),
    title: article.title,
    summary: article.description || undefined,
    url: article.url,
    source: article.source,
    publishedAt: new Date(article.publishedDate),
    symbols: article.tickers.map((t) => t.toUpperCase()),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

function mapAssetType(type?: string): SearchResult["type"] {
  if (!type) return "stock";
  const t = type.toLowerCase();
  if (t === "stock" || t === "equity") return "stock";
  if (t === "etf") return "etf";
  if (t === "mutualfund" || t === "mutual fund") return "mutual-fund";
  if (t === "crypto") return "crypto";
  if (t === "forex") return "forex";
  return "unknown";
}
