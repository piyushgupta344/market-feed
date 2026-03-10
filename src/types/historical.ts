export type HistoricalInterval =
  | "1m"
  | "2m"
  | "5m"
  | "15m"
  | "30m"
  | "60m"
  | "90m"
  | "1h"
  | "1d"
  | "5d"
  | "1wk"
  | "1mo"
  | "3mo";

export interface HistoricalOptions {
  /**
   * Start date — ISO 8601 string ("2024-01-01") or a Date object.
   * Defaults to 1 year ago.
   */
  period1?: string | Date;
  /**
   * End date — ISO 8601 string or a Date object.
   * Defaults to today.
   */
  period2?: string | Date;
  /** Bar interval. Defaults to "1d". */
  interval?: HistoricalInterval;
  /** Include the raw provider response on each bar */
  raw?: boolean;
}

export interface HistoricalBar {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Adjusted close price (splits + dividends). May be absent for intraday. */
  adjClose?: number;
  volume: number;
  raw?: unknown;
}
