import type { Quote, QuoteOptions } from "../types/quote.js";

/** A minimal interface for fetching quotes — satisfied by MarketFeed. */
export interface QuoteFetcher {
  quote(symbols: string[], options?: QuoteOptions): Promise<Quote[]>;
}

/** A single holding in the portfolio. */
export interface Position {
  /** Ticker symbol, e.g. "AAPL" */
  symbol: string;
  /**
   * Number of units held.
   * Positive = long, negative = short.
   */
  quantity: number;
  /** Average cost per unit (in `currency`). */
  avgCost: number;
  /** Currency of the position. Defaults to "USD". */
  currency?: string;
  /** Date the position was opened. */
  openedAt?: Date;
  /** Free-form notes. */
  notes?: string;
}

/** A position enriched with the current market price and P&L calculations. */
export interface PositionSnapshot extends Position {
  /** Current market price per unit. */
  currentPrice: number;
  /** Total market value (quantity × currentPrice). */
  marketValue: number;
  /** Total cost basis (quantity × avgCost). */
  costBasis: number;
  /** Unrealised P&L (marketValue − costBasis). */
  unrealizedPnl: number;
  /** Unrealised P&L as a decimal fraction of |costBasis|, e.g. 0.05 = 5%. */
  unrealizedPnlPct: number;
  /** Today's change in portfolio value for this position (quantity × quote.change). */
  dayChange: number;
  /** Today's change as a percentage (same as quote.changePercent). */
  dayChangePct: number;
  /** The underlying quote used for this calculation. */
  quote: Quote;
}

/** Aggregated snapshot across all positions. */
export interface PortfolioSnapshot {
  /** Snapshot of each position with live P&L. */
  positions: PositionSnapshot[];
  /** Sum of all cost bases. */
  totalCostBasis: number;
  /** Sum of current market values. */
  totalMarketValue: number;
  /** Total unrealised P&L (totalMarketValue − totalCostBasis). */
  totalUnrealizedPnl: number;
  /** Total unrealised P&L as a fraction of |totalCostBasis|. */
  totalUnrealizedPnlPct: number;
  /** Total today's change in portfolio value. */
  totalDayChange: number;
  /** Total today's change as a fraction of prior-day total market value. */
  totalDayChangePct: number;
  /** When this snapshot was computed. */
  asOf: Date;
}
