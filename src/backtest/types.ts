import type { HistoricalBar } from "../types/historical.js";

export interface BacktestTrade {
  symbol: string;
  entryDate: Date;
  entryPrice: number;
  exitDate: Date;
  exitPrice: number;
  quantity: number;
  /** Net P&L after commission */
  pnl: number;
  /** P&L as a fraction of entry cost, e.g. 0.05 = 5% gain */
  pnlPct: number;
}

export interface BacktestResult {
  symbol: string;
  /** Total return as a fraction, e.g. 0.25 = 25% */
  totalReturn: number;
  /** Annualised return (CAGR) as a fraction */
  annualizedReturn: number;
  /** Annualised Sharpe ratio (risk-free rate = 0) */
  sharpeRatio: number;
  /** Maximum peak-to-trough drawdown as a positive fraction, e.g. 0.15 = 15% */
  maxDrawdown: number;
  /** Fraction of trades that were profitable, e.g. 0.6 = 60% */
  winRate: number;
  /** Gross profit / gross loss. Infinity when there are no losses. */
  profitFactor: number;
  totalTrades: number;
  trades: BacktestTrade[];
}

export interface BacktestOptions {
  /** Starting capital in base currency. Defaults to 100_000. */
  initialCapital?: number;
  /** Shares / units traded per signal. Defaults to 1. */
  quantity?: number;
  /** One-way commission per trade in currency units. Defaults to 0. */
  commission?: number;
}

/**
 * Returns true on bar `index` if a long position should be opened.
 * Bars at indices < index are historical; bars[index] is the current bar.
 */
export type EntrySignal = (bars: readonly HistoricalBar[], index: number) => boolean;

/**
 * Returns true on bar `index` if the open position should be closed.
 * `entryPrice` is the price at which the position was entered.
 */
export type ExitSignal = (
  bars: readonly HistoricalBar[],
  index: number,
  entryPrice: number,
) => boolean;
