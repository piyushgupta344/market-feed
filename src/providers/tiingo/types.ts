export interface TiingoMetaResponse {
  ticker: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  exchangeCode: string;
}

export interface TiingoDailyBar {
  /** "YYYY-MM-DDT00:00:00+00:00" */
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjOpen?: number;
  adjHigh?: number;
  adjLow?: number;
  adjClose?: number;
  adjVolume?: number;
  divCash?: number;
  splitFactor?: number;
}

/** Real-time IEX quote response (array of one object) */
export interface TiingoIexQuote {
  ticker: string;
  /** ISO timestamp string */
  timestamp: string;
  last: number;
  lastSize: number;
  prevClose: number;
  open: number | null;
  high: number | null;
  low: number | null;
  mid: number | null;
  volume: number;
  bidSize: number;
  bidPrice: number;
  askSize: number;
  askPrice: number;
  tngoLast: number;
}

export interface TiingoSearchResultItem {
  ticker: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  exchangeCode: string;
  assetType?: string;
}

export interface TiingoNewsArticle {
  id: number;
  title: string;
  url: string;
  description: string;
  source: string;
  /** ISO timestamp string */
  publishedDate: string;
  crawlDate: string;
  tags: string[];
  tickers: string[];
}

export interface TiingoErrorResponse {
  detail: string;
}

// ---------------------------------------------------------------------------
// Fundamentals — /tiingo/fundamentals/{ticker}/statements
// ---------------------------------------------------------------------------
export interface TiingoFundamentalsStatement {
  /** ISO date string — period end date */
  date: string;
  year: number;
  /** 0 = annual, 1-4 = quarter */
  quarter: number;
  statementData: {
    incomeStatement?: TiingoDataPoint[];
    balanceSheet?: TiingoDataPoint[];
    cashFlow?: TiingoDataPoint[];
  };
}

export interface TiingoDataPoint {
  dataCode: string;
  value: number | null;
}
