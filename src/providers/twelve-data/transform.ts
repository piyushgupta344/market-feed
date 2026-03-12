import type { CompanyProfile } from "../../types/company.js";
import type { HistoricalBar } from "../../types/historical.js";
import type { Quote } from "../../types/quote.js";
import type { AssetType, SearchResult } from "../../types/search.js";
import type {
  TwelveDataProfileResponse,
  TwelveDataQuoteResponse,
  TwelveDataSearchResult,
  TwelveDataTimeSeriesBar,
} from "./types.js";

const PROVIDER = "twelve-data";

export function transformQuote(data: TwelveDataQuoteResponse, raw?: unknown): Quote {
  return {
    symbol: data.symbol,
    name: data.name,
    price: Number(data.close),
    change: Number(data.change),
    changePercent: Number(data.percent_change),
    open: Number(data.open),
    high: Number(data.high),
    low: Number(data.low),
    close: Number(data.close),
    previousClose: Number(data.previous_close),
    volume: Number(data.volume),
    ...(data.average_volume !== undefined ? { avgVolume: Number(data.average_volume) } : {}),
    ...(data.fifty_two_week !== undefined
      ? {
          fiftyTwoWeekHigh: Number(data.fifty_two_week.high),
          fiftyTwoWeekLow: Number(data.fifty_two_week.low),
        }
      : {}),
    currency: data.currency,
    exchange: data.exchange,
    timestamp: new Date(data.timestamp * 1000),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

export function transformHistoricalBar(bar: TwelveDataTimeSeriesBar, raw?: unknown): HistoricalBar {
  return {
    date: new Date(bar.datetime),
    open: Number(bar.open),
    high: Number(bar.high),
    low: Number(bar.low),
    close: Number(bar.close),
    volume: Number(bar.volume),
    ...(raw !== undefined ? { raw } : {}),
  };
}

export function transformSearch(result: TwelveDataSearchResult, raw?: unknown): SearchResult {
  return {
    symbol: result.symbol,
    name: result.instrument_name,
    type: mapInstrumentType(result.instrument_type),
    exchange: result.exchange || undefined,
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

export function transformProfile(data: TwelveDataProfileResponse, raw?: unknown): CompanyProfile {
  return {
    symbol: data.symbol,
    name: data.name,
    description: data.description || undefined,
    sector: data.sector || undefined,
    industry: data.industry || undefined,
    country: data.country || undefined,
    employees: data.employees || undefined,
    website: data.website || undefined,
    ceo: data.CEO || undefined,
    exchange: data.exchange || undefined,
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

function mapInstrumentType(type: string): AssetType {
  const t = type.toLowerCase();
  if (t.includes("common stock") || t === "cs") return "stock";
  if (t.includes("etf") || t.includes("exchange traded fund")) return "etf";
  if (t.includes("crypto")) return "crypto";
  if (t.includes("forex") || t.includes("currency")) return "forex";
  if (t.includes("mutual fund") || t.includes("fund")) return "mutual-fund";
  if (t.includes("future")) return "future";
  if (t.includes("index")) return "index";
  return "unknown";
}
