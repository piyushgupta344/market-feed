export interface Quote {
  /** Ticker symbol, e.g. "AAPL" */
  symbol: string;
  /** Full company or asset name */
  name: string;
  /** Current or last-traded price */
  price: number;
  /** Absolute change from previous close */
  change: number;
  /** Percentage change from previous close */
  changePercent: number;
  /** Opening price for current/last session */
  open: number;
  /** Intraday high */
  high: number;
  /** Intraday low */
  low: number;
  /** Closing price of last completed session */
  close: number;
  /** Previous session close */
  previousClose: number;
  /** Volume traded in current/last session */
  volume: number;
  /** Average volume (30-day) */
  avgVolume?: number;
  /** Market capitalisation in quote currency */
  marketCap?: number;
  /** 52-week high */
  fiftyTwoWeekHigh?: number;
  /** 52-week low */
  fiftyTwoWeekLow?: number;
  /** Currency the price is quoted in, e.g. "USD" */
  currency: string;
  /** Exchange identifier, e.g. "NASDAQ" */
  exchange: string;
  /** Timestamp of the quote data */
  timestamp: Date;
  /** Which provider delivered this data */
  provider: string;
  /** Raw provider response — available when `raw: true` is passed to the client */
  raw?: unknown;
}

export interface QuoteOptions {
  /** Include the raw provider response on each Quote object */
  raw?: boolean;
}
