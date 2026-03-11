export type ExchangeId =
  | "NYSE"
  | "NASDAQ"
  | "LSE"
  | "TSX"
  | "ASX"
  | "XETRA"
  | "NSE"
  | "BSE"
  | "CRYPTO";

export interface ExchangeInfo {
  id: ExchangeId;
  /** Human-readable name */
  name: string;
  /** ISO 10383 Market Identifier Code */
  mic: string;
  /** IANA timezone identifier */
  timezone: string;
  /** Regular session open time in local exchange time, "HH:MM" */
  openTime: string;
  /** Regular session close time in local exchange time, "HH:MM" */
  closeTime: string;
  /** Pre-market session start, "HH:MM" */
  preOpenTime: string;
  /** Post-market session end, "HH:MM" */
  postCloseTime: string;
  /** Primary trading currency */
  currency: string;
  /**
   * When `true` the market is open 24/7 — no weekends, holidays, or session boundaries.
   * Used for CRYPTO and other always-on markets.
   */
  alwaysOpen?: boolean;
}

/** Parts of a local date/time in an arbitrary timezone */
export interface LocalTimeParts {
  year: number;
  month: number; // 1-based
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
  /** Full weekday name e.g. "Monday" */
  weekday: string;
}
