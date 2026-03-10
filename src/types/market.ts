export type TradingSession = "pre" | "regular" | "post" | "closed";

export interface MarketStatus {
  /** Whether the primary session is currently open */
  isOpen: boolean;
  /** Current trading session type */
  session: TradingSession;
  /** Next session open time */
  nextOpen?: Date;
  /** Current (or next) session close time */
  nextClose?: Date;
  /** Market/exchange identifier, e.g. "US", "LSE" */
  market?: string;
  /** Timezone of the exchange, e.g. "America/New_York" */
  timezone?: string;
  provider: string;
  raw?: unknown;
}

export interface MarketStatusOptions {
  raw?: boolean;
}
