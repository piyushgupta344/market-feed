export interface FinnhubQuoteResponse {
  /** Current price */
  c: number;
  /** Change from previous close */
  d: number;
  /** Percent change from previous close */
  dp: number;
  /** Intraday high */
  h: number;
  /** Intraday low */
  l: number;
  /** Open price */
  o: number;
  /** Previous close */
  pc: number;
  /** Timestamp (Unix seconds) */
  t: number;
}

export interface FinnhubCandlesResponse {
  c: number[];
  h: number[];
  l: number[];
  o: number[];
  /** "ok" or "no_data" */
  s: string;
  /** Timestamps (Unix seconds) */
  t: number[];
  v: number[];
}

export interface FinnhubSearchResponse {
  count: number;
  result: FinnhubSearchResult[];
}

export interface FinnhubSearchResult {
  description: string;
  displaySymbol: string;
  symbol: string;
  /** E.g. "Common Stock", "ETP", "Crypto" */
  type: string;
}

export interface FinnhubProfileResponse {
  country: string;
  currency: string;
  exchange: string;
  finnhubIndustry: string;
  ipo: string;
  logo: string;
  /** Market cap in millions USD */
  marketCapitalization: number;
  name: string;
  phone: string;
  shareOutstanding: number;
  ticker: string;
  weburl: string;
  ggroup: string;
  gind: string;
  gsector: string;
  gsubind: string;
}

export interface FinnhubNewsArticle {
  category: string;
  /** Unix seconds */
  datetime: number;
  headline: string;
  id: number;
  image: string;
  /** Comma-separated related tickers */
  related: string;
  source: string;
  summary: string;
  url: string;
}

export interface FinnhubEarningsEntry {
  actual: number | null;
  estimate: number | null;
  /** Period end date, e.g. "2024-06-30" */
  period: string;
  quarter: number;
  surprise: number | null;
  surprisePercent: number | null;
  symbol: string;
  year: number;
}

export type FinnhubEarningsResponse = FinnhubEarningsEntry[];
