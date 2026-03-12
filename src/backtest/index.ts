import type { HistoricalBar } from "../types/historical.js";
import type {
  BacktestOptions,
  BacktestResult,
  BacktestTrade,
  EntrySignal,
  ExitSignal,
} from "./types.js";

export type { BacktestOptions, BacktestResult, BacktestTrade, EntrySignal, ExitSignal } from "./types.js";
export {
  portfolioBacktest,
} from "./portfolio.js";
export type {
  PortfolioAsset,
  PortfolioAssetSummary,
  PortfolioBacktestOptions,
  PortfolioBacktestResult,
  PositionSizing,
} from "./portfolio.js";

/**
 * Run a simple long-only backtest over a series of OHLCV bars.
 *
 * - Signals fire at bar[i].close (end-of-day)
 * - Trades execute at bar[i].close (same bar, conservative assumption)
 * - At most one open position at a time
 * - Exit signal is checked before entry on each bar
 * - Any open position at the end of the series is closed at the last bar's close
 *
 * @param symbol Ticker symbol — used for labelling trade records
 * @param bars   Chronologically sorted bars (oldest first)
 * @param entry  Return true to open a long position at the current bar's close
 * @param exit   Return true to close the open position at the current bar's close
 */
export function backtest(
  symbol: string,
  bars: readonly HistoricalBar[],
  entry: EntrySignal,
  exit: ExitSignal,
  options?: BacktestOptions,
): BacktestResult {
  const initialCapital = options?.initialCapital ?? 100_000;
  const qty = options?.quantity ?? 1;
  const commission = options?.commission ?? 0;
  const trades: BacktestTrade[] = [];
  const equityCurve: number[] = [];

  let cash = initialCapital;
  let inTrade = false;
  let entryPrice = 0;
  let entryDate: Date = new Date(0);

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i]!;

    // Exit check (before entry — allows same-bar flip in future extensions)
    if (inTrade && exit(bars, i, entryPrice)) {
      const exitPrice = bar.close;
      cash += exitPrice * qty - commission;
      const pnl = (exitPrice - entryPrice) * qty - 2 * commission;
      const pnlPct = entryPrice > 0 ? (exitPrice - entryPrice) / entryPrice : 0;
      trades.push({
        symbol,
        entryDate,
        entryPrice,
        exitDate: bar.date,
        exitPrice,
        quantity: qty,
        pnl,
        pnlPct,
      });
      inTrade = false;
    }

    // Entry check
    if (!inTrade && entry(bars, i)) {
      entryPrice = bar.close;
      entryDate = bar.date;
      cash -= entryPrice * qty + commission;
      inTrade = true;
    }

    // Record mark-to-market equity at bar close
    equityCurve.push(cash + (inTrade ? qty * bar.close : 0));
  }

  // Close any open position at last bar close
  if (inTrade && bars.length > 0) {
    const last = bars[bars.length - 1]!;
    const exitPrice = last.close;
    cash += exitPrice * qty - commission;
    const pnl = (exitPrice - entryPrice) * qty - 2 * commission;
    const pnlPct = entryPrice > 0 ? (exitPrice - entryPrice) / entryPrice : 0;
    trades.push({
      symbol,
      entryDate,
      entryPrice,
      exitDate: last.date,
      exitPrice,
      quantity: qty,
      pnl,
      pnlPct,
    });
  }

  const finalEquity = cash;
  const totalReturn = initialCapital > 0 ? (finalEquity - initialCapital) / initialCapital : 0;

  // Annualised return (CAGR)
  const first = bars[0];
  const last = bars[bars.length - 1];
  let annualizedReturn = totalReturn;
  if (first && last && bars.length > 1) {
    const years =
      (last.date.getTime() - first.date.getTime()) / (365.25 * 24 * 3_600 * 1_000);
    if (years > 0) {
      annualizedReturn = Math.pow(1 + totalReturn, 1 / years) - 1;
    }
  }

  // Annualised Sharpe ratio from daily equity returns (risk-free rate = 0)
  const dailyReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1]!;
    dailyReturns.push(prev > 0 ? (equityCurve[i]! - prev) / prev : 0);
  }
  const n = dailyReturns.length;
  const mean = n > 0 ? dailyReturns.reduce((s, r) => s + r, 0) / n : 0;
  const variance = n > 1 ? dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / n : 0;
  const std = Math.sqrt(variance);
  const sharpeRatio = std > 0 ? (mean / std) * Math.sqrt(252) : 0;

  // Maximum drawdown
  let peak = equityCurve[0] ?? initialCapital;
  let maxDD = 0;
  for (const v of equityCurve) {
    if (v > peak) peak = v;
    const dd = peak > 0 ? (peak - v) / peak : 0;
    if (dd > maxDD) maxDD = dd;
  }

  // Win rate and profit factor
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const winRate = trades.length > 0 ? wins.length / trades.length : 0;
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  return {
    symbol,
    totalReturn,
    annualizedReturn,
    sharpeRatio,
    maxDrawdown: maxDD,
    winRate,
    profitFactor,
    totalTrades: trades.length,
    trades,
  };
}
