export interface EarningsEvent {
  symbol: string;
  /** Report date — quarter-end date or earnings announcement date */
  date: Date;
  /** Period label, e.g. "Q3 2024" */
  period?: string;
  epsActual?: number;
  epsEstimate?: number;
  /** Beat/miss as a percentage — positive = beat, negative = miss */
  epsSurprisePct?: number;
  revenueActual?: number;
  revenueEstimate?: number;
  provider: string;
  raw?: unknown;
}

export interface EarningsOptions {
  limit?: number;
  raw?: boolean;
}
