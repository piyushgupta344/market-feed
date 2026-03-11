import type { CompanyProfile } from "../../types/company.js";
import type { HistoricalBar } from "../../types/historical.js";
import type { NewsItem } from "../../types/news.js";
import type { Quote } from "../../types/quote.js";
import type { AssetType, SearchResult } from "../../types/search.js";
import type {
  FinnhubCandlesResponse,
  FinnhubNewsArticle,
  FinnhubProfileResponse,
  FinnhubQuoteResponse,
  FinnhubSearchResult,
} from "./types.js";

const PROVIDER = "finnhub";

export function transformQuote(
  symbol: string,
  data: FinnhubQuoteResponse,
  raw?: unknown,
): Quote {
  return {
    symbol: symbol.toUpperCase(),
    name: symbol.toUpperCase(),
    price: data.c,
    change: data.d,
    changePercent: data.dp,
    open: data.o,
    high: data.h,
    low: data.l,
    close: data.c,
    previousClose: data.pc,
    volume: 0,
    currency: "USD",
    exchange: "",
    timestamp: new Date(data.t * 1000),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

export function transformHistorical(
  data: FinnhubCandlesResponse,
  raw?: unknown,
): HistoricalBar[] {
  if (data.s !== "ok") return [];

  return data.t.map((timestamp, i) => ({
    date: new Date(timestamp * 1000),
    open: data.o[i] ?? 0,
    high: data.h[i] ?? 0,
    low: data.l[i] ?? 0,
    close: data.c[i] ?? 0,
    volume: data.v[i] ?? 0,
    ...(raw !== undefined ? { raw } : {}),
  }));
}

export function transformSearch(result: FinnhubSearchResult, raw?: unknown): SearchResult {
  return {
    symbol: result.displaySymbol,
    name: result.description,
    type: mapType(result.type),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

export function transformCompany(data: FinnhubProfileResponse, raw?: unknown): CompanyProfile {
  return {
    symbol: data.ticker,
    name: data.name,
    description: undefined,
    sector: data.gsector || data.finnhubIndustry || undefined,
    industry: data.gind || undefined,
    country: data.country || undefined,
    website: data.weburl || undefined,
    currency: data.currency || undefined,
    exchange: data.exchange || undefined,
    // Finnhub reports marketCap in millions USD
    marketCap: data.marketCapitalization ? data.marketCapitalization * 1_000_000 : undefined,
    ipoDate: data.ipo ? new Date(data.ipo) : undefined,
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

export function transformNews(article: FinnhubNewsArticle, raw?: unknown): NewsItem {
  return {
    id: String(article.id),
    title: article.headline,
    summary: article.summary || undefined,
    url: article.url,
    source: article.source,
    publishedAt: new Date(article.datetime * 1000),
    symbols: article.related
      ? article.related
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    thumbnail: article.image || undefined,
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

function mapType(type: string): AssetType {
  const t = type.toLowerCase();
  if (t === "common stock" || t === "cs") return "stock";
  if (t === "etp" || t.includes("etf")) return "etf";
  if (t.includes("crypto")) return "crypto";
  if (t.includes("forex") || t.includes("currency")) return "forex";
  if (t.includes("mutual fund") || t.includes("fund")) return "mutual-fund";
  if (t.includes("future")) return "future";
  if (t.includes("index")) return "index";
  return "unknown";
}
