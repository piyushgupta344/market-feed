/**
 * Raw response shapes from the Polygon.io REST API v2/v3.
 */

// ---------------------------------------------------------------------------
// Snapshot (quote)
// ---------------------------------------------------------------------------
export interface PolygonSnapshotResponse {
  status: string;
  ticker?: PolygonSnapshotTicker;
  tickers?: PolygonSnapshotTicker[];
  error?: string;
  message?: string;
}

export interface PolygonSnapshotTicker {
  ticker: string;
  todaysChangePerc: number;
  todaysChange: number;
  updated: number;
  day: PolygonOHLCV;
  lastTrade: PolygonLastTrade;
  lastQuote: PolygonLastQuote;
  min: PolygonOHLCV;
  prevDay: PolygonOHLCV;
}

export interface PolygonOHLCV {
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
  vw?: number; // volume-weighted avg
}

export interface PolygonLastTrade {
  p: number; // price
  s: number; // size
  t: number; // timestamp (ms)
}

export interface PolygonLastQuote {
  P: number; // ask price
  S: number; // ask size
  p: number; // bid price
  s: number; // bid size
  t: number; // timestamp (ms)
}

// ---------------------------------------------------------------------------
// Aggregates (historical bars)
// ---------------------------------------------------------------------------
export interface PolygonAggregatesResponse {
  ticker: string;
  status: string;
  queryCount: number;
  resultsCount: number;
  adjusted: boolean;
  results?: PolygonAggBar[];
  next_url?: string;
  error?: string;
  message?: string;
}

export interface PolygonAggBar {
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
  vw?: number; // volume-weighted avg
  t: number; // timestamp (ms, start of window)
  n?: number; // number of transactions
}

// ---------------------------------------------------------------------------
// Ticker search
// ---------------------------------------------------------------------------
export interface PolygonTickersResponse {
  status: string;
  count?: number;
  next_url?: string;
  results?: PolygonTicker[];
  error?: string;
}

export interface PolygonTicker {
  ticker: string;
  name: string;
  market: string;
  locale: string;
  primary_exchange?: string;
  type?: string;
  active: boolean;
  currency_name?: string;
  cik?: string;
}

// ---------------------------------------------------------------------------
// Ticker details v3 (company profile)
// ---------------------------------------------------------------------------
export interface PolygonTickerDetailsResponse {
  status: string;
  results?: PolygonTickerDetails;
  error?: string;
  message?: string;
}

export interface PolygonTickerDetails {
  ticker: string;
  name: string;
  market: string;
  locale: string;
  primary_exchange?: string;
  type?: string;
  active: boolean;
  currency_name?: string;
  description?: string;
  sic_code?: string;
  sic_description?: string;
  ticker_root?: string;
  homepage_url?: string;
  total_employees?: number;
  list_date?: string;
  branding?: {
    logo_url?: string;
    icon_url?: string;
  };
  market_cap?: number;
  phone_number?: string;
  address?: {
    address1?: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
  };
}

// ---------------------------------------------------------------------------
// Dividends
// ---------------------------------------------------------------------------
export interface PolygonDividendsResponse {
  status: string;
  results?: PolygonDividend[];
  next_url?: string;
  error?: string;
  message?: string;
}

export interface PolygonDividend {
  ticker: string;
  ex_dividend_date: string;
  pay_date?: string;
  declaration_date?: string;
  record_date?: string;
  cash_amount: number;
  currency?: string;
  /** 1=annual, 2=semi-annual, 4=quarterly, 12=monthly */
  frequency?: number;
  dividend_type?: string;
}

// ---------------------------------------------------------------------------
// Splits
// ---------------------------------------------------------------------------
export interface PolygonSplitsResponse {
  status: string;
  results?: PolygonSplit[];
  next_url?: string;
  error?: string;
  message?: string;
}

export interface PolygonSplit {
  ticker: string;
  execution_date: string;
  split_from: number;
  split_to: number;
}

// ---------------------------------------------------------------------------
// News
// ---------------------------------------------------------------------------
export interface PolygonNewsResponse {
  status: string;
  count?: number;
  next_url?: string;
  results?: PolygonNewsArticle[];
  error?: string;
}

export interface PolygonNewsArticle {
  id: string;
  title: string;
  author?: string;
  published_utc: string;
  article_url: string;
  tickers?: string[];
  description?: string;
  keywords?: string[];
  publisher?: {
    name?: string;
    homepage_url?: string;
  };
  image_url?: string;
  amp_url?: string;
}
