import type { HistoricalBar } from "../types/historical.js";
import type { BacktestTrade, EntrySignal, ExitSignal } from "./types.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Position sizing strategy for each trade entry.
 * - `fixed_quantity` — always trade N shares (mirrors single-asset backtest default)
 * - `fixed_dollar`   — buy floor(amount / entryPrice) shares at each entry
 * - `percent_equity` — buy floor((equity × pct/100) / entryPrice) shares at each entry
 */
export type PositionSizing =
  | { type: "fixed_quantity"; quantity: number }
  | { type: "fixed_dollar"; amount: number }
  | { type: "percent_equity"; pct: number };

/** Per-asset configuration for the portfolio backtest. */
export interface PortfolioAsset {
  symbol: string;
  bars: readonly HistoricalBar[];
  entry: EntrySignal;
  exit: ExitSignal;
  /** Overrides the global sizing for this specific asset. */
  sizing?: PositionSizing;
}

export interface PortfolioBacktestOptions {
  /** Starting cash for the whole portfolio. Defaults to 100_000. */
  initialCapital?: number;
  /** One-way commission per trade in currency units. Defaults to 0. */
  commission?: number;
  /** Default position sizing for all assets. Defaults to `{ type: "fixed_quantity", quantity: 1 }`. */
  sizing?: PositionSizing;
  /**
   * Buy-and-hold benchmark bars for return comparison (e.g. SPY, QQQ).
   * When provided, `benchmarkReturn` and `benchmarkAnnualizedReturn` are populated.
   */
  benchmarkBars?: readonly HistoricalBar[];
  /** Display label for the benchmark. Defaults to "benchmark". */
  benchmarkSymbol?: string;
}

export interface PortfolioAssetSummary {
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  totalPnl: number;
  trades: BacktestTrade[];
}

export interface PortfolioBacktestResult {
  /** Combined portfolio total return as a fraction (e.g. 0.25 = 25%) */
  totalReturn: number;
  /** Annualised CAGR as a fraction */
  annualizedReturn: number;
  /** Annualised Sharpe ratio across the combined equity curve (risk-free = 0) */
  sharpeRatio: number;
  /** Max peak-to-trough drawdown of the combined portfolio equity curve */
  maxDrawdown: number;
  /** Combined win rate across all assets and all trades */
  winRate: number;
  /** Combined profit factor — gross profit / gross loss */
  profitFactor: number;
  /** Total round-trip trades across all assets */
  totalTrades: number;
  /** All trades sorted by exit date */
  trades: BacktestTrade[];
  /** Date-stamped combined equity curve */
  equityCurve: Array<{ date: Date; equity: number }>;
  /** Per-asset trade summary */
  byAsset: Record<string, PortfolioAssetSummary>;
  /** Buy-and-hold benchmark total return (only when benchmarkBars provided) */
  benchmarkReturn?: number;
  /** Buy-and-hold benchmark annualised return (only when benchmarkBars provided) */
  benchmarkAnnualizedReturn?: number;
  /** Benchmark label */
  benchmarkSymbol?: string;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Run a multi-asset portfolio backtest over a shared cash pool.
 *
 * Key behaviours:
 * - All assets draw from and return cash to a single shared pool.
 * - At most one open position per asset at a time.
 * - Exit is checked before entry on each bar (same as single-asset backtest).
 * - Any open positions at the end of the series are closed at each asset's last bar close.
 * - The equity curve includes a snapshot at every unique date across all assets.
 */
export function portfolioBacktest(
  assets: PortfolioAsset[],
  options?: PortfolioBacktestOptions,
): PortfolioBacktestResult {
  const initialCapital = options?.initialCapital ?? 100_000;
  const commission = options?.commission ?? 0;
  const globalSizing: PositionSizing =
    options?.sizing ?? { type: "fixed_quantity", quantity: 1 };

  if (assets.length === 0) {
    return emptyResult(initialCapital);
  }

  // ---- Build per-asset date → index maps -----------------------------------
  const indexMaps: Map<string, number>[] = [];
  const barMaps: Map<string, HistoricalBar>[] = [];
  const dateSet = new Set<string>();

  for (const asset of assets) {
    const iMap = new Map<string, number>();
    const bMap = new Map<string, HistoricalBar>();
    for (let i = 0; i < asset.bars.length; i++) {
      const bar = asset.bars[i]!;
      const key = dateKey(bar.date);
      dateSet.add(key);
      iMap.set(key, i);
      bMap.set(key, bar);
    }
    indexMaps.push(iMap);
    barMaps.push(bMap);
  }

  const sortedDates = [...dateSet].sort();

  // ---- Per-asset position state --------------------------------------------
  type PositionState = {
    inTrade: boolean;
    entryPrice: number;
    entryDate: Date;
    quantity: number;
  };
  const positions: PositionState[] = assets.map(() => ({
    inTrade: false,
    entryPrice: 0,
    entryDate: new Date(0),
    quantity: 0,
  }));

  let cash = initialCapital;
  const allTrades: BacktestTrade[] = [];
  const equityCurve: Array<{ date: Date; equity: number }> = [];

  // ---- Main simulation loop ------------------------------------------------
  for (const dk of sortedDates) {
    for (let ai = 0; ai < assets.length; ai++) {
      const asset = assets[ai]!;
      const idx = indexMaps[ai]?.get(dk);
      if (idx === undefined) continue;
      const bar = asset.bars[idx]!;
      const pos = positions[ai]!;

      // Exit check
      if (pos.inTrade && asset.exit(asset.bars, idx, pos.entryPrice)) {
        cash += bar.close * pos.quantity - commission;
        const pnl = (bar.close - pos.entryPrice) * pos.quantity - 2 * commission;
        allTrades.push({
          symbol: asset.symbol,
          entryDate: pos.entryDate,
          entryPrice: pos.entryPrice,
          exitDate: bar.date,
          exitPrice: bar.close,
          quantity: pos.quantity,
          pnl,
          pnlPct: pos.entryPrice > 0 ? (bar.close - pos.entryPrice) / pos.entryPrice : 0,
        });
        pos.inTrade = false;
      }

      // Entry check
      if (!pos.inTrade && asset.entry(asset.bars, idx)) {
        const sizing = asset.sizing ?? globalSizing;
        const currentEquity = cash + openValue(positions, barMaps, dk);
        const qty = computeQty(sizing, bar.close, currentEquity);
        const cost = bar.close * qty + commission;
        if (qty > 0 && cash >= cost) {
          cash -= cost;
          pos.inTrade = true;
          pos.entryPrice = bar.close;
          pos.entryDate = bar.date;
          pos.quantity = qty;
        }
      }
    }

    // Snapshot combined equity
    equityCurve.push({
      date: new Date(dk),
      equity: cash + openValue(positions, barMaps, dk),
    });
  }

  // ---- Close remaining open positions at last bar -------------------------
  for (let ai = 0; ai < assets.length; ai++) {
    const asset = assets[ai]!;
    const pos = positions[ai]!;
    if (!pos.inTrade || asset.bars.length === 0) continue;
    const last = asset.bars[asset.bars.length - 1]!;
    cash += last.close * pos.quantity - commission;
    const pnl = (last.close - pos.entryPrice) * pos.quantity - 2 * commission;
    allTrades.push({
      symbol: asset.symbol,
      entryDate: pos.entryDate,
      entryPrice: pos.entryPrice,
      exitDate: last.date,
      exitPrice: last.close,
      quantity: pos.quantity,
      pnl,
      pnlPct: pos.entryPrice > 0 ? (last.close - pos.entryPrice) / pos.entryPrice : 0,
    });
    pos.inTrade = false;
  }

  // Update last equity snapshot to reflect closed positions
  if (equityCurve.length > 0) {
    equityCurve[equityCurve.length - 1]!.equity = cash;
  }

  // ---- Portfolio-level metrics --------------------------------------------
  const finalEquity = cash;
  const totalReturn = initialCapital > 0 ? (finalEquity - initialCapital) / initialCapital : 0;

  const firstDate = equityCurve[0]?.date;
  const lastDate = equityCurve[equityCurve.length - 1]?.date;
  let annualizedReturn = totalReturn;
  if (firstDate && lastDate) {
    const years = (lastDate.getTime() - firstDate.getTime()) / (365.25 * 24 * 3_600 * 1_000);
    if (years > 0) annualizedReturn = (1 + totalReturn) ** (1 / years) - 1;
  }

  // Sharpe (annualised, risk-free = 0)
  const dailyReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1]!.equity;
    dailyReturns.push(prev > 0 ? (equityCurve[i]!.equity - prev) / prev : 0);
  }
  const n = dailyReturns.length;
  const meanR = n > 0 ? dailyReturns.reduce((s, r) => s + r, 0) / n : 0;
  const varR = n > 1 ? dailyReturns.reduce((s, r) => s + (r - meanR) ** 2, 0) / n : 0;
  const sharpeRatio = varR > 0 ? (meanR / Math.sqrt(varR)) * Math.sqrt(252) : 0;

  // Max drawdown
  let peak = equityCurve[0]?.equity ?? initialCapital;
  let maxDrawdown = 0;
  for (const { equity } of equityCurve) {
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? (peak - equity) / peak : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Win/loss
  const wins = allTrades.filter((t) => t.pnl > 0);
  const losses = allTrades.filter((t) => t.pnl <= 0);
  const winRate = allTrades.length > 0 ? wins.length / allTrades.length : 0;
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  // Per-asset summary
  const byAsset: Record<string, PortfolioAssetSummary> = {};
  for (const asset of assets) {
    const assetTrades = allTrades.filter((t) => t.symbol === asset.symbol);
    const aWins = assetTrades.filter((t) => t.pnl > 0);
    const aLosses = assetTrades.filter((t) => t.pnl <= 0);
    const agp = aWins.reduce((s, t) => s + t.pnl, 0);
    const agl = Math.abs(aLosses.reduce((s, t) => s + t.pnl, 0));
    byAsset[asset.symbol] = {
      totalTrades: assetTrades.length,
      winRate: assetTrades.length > 0 ? aWins.length / assetTrades.length : 0,
      profitFactor: agl > 0 ? agp / agl : agp > 0 ? Infinity : 0,
      totalPnl: assetTrades.reduce((s, t) => s + t.pnl, 0),
      trades: assetTrades,
    };
  }

  // Benchmark buy-and-hold
  let benchmarkReturn: number | undefined;
  let benchmarkAnnualizedReturn: number | undefined;
  const benchmarkSymbol = options?.benchmarkSymbol ?? "benchmark";
  if (options?.benchmarkBars && options.benchmarkBars.length >= 2) {
    const bm = options.benchmarkBars;
    const bf = bm[0]!;
    const bl = bm[bm.length - 1]!;
    benchmarkReturn = bf.close > 0 ? (bl.close - bf.close) / bf.close : 0;
    const bmYears = (bl.date.getTime() - bf.date.getTime()) / (365.25 * 24 * 3_600 * 1_000);
    benchmarkAnnualizedReturn =
      bmYears > 0 ? (1 + benchmarkReturn) ** (1 / bmYears) - 1 : benchmarkReturn;
  }

  return {
    totalReturn,
    annualizedReturn,
    sharpeRatio,
    maxDrawdown,
    winRate,
    profitFactor,
    totalTrades: allTrades.length,
    trades: allTrades.sort((a, b) => a.exitDate.getTime() - b.exitDate.getTime()),
    equityCurve,
    byAsset,
    ...(benchmarkReturn !== undefined ? { benchmarkReturn, benchmarkAnnualizedReturn, benchmarkSymbol } : {}),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function openValue(
  positions: Array<{ inTrade: boolean; entryPrice: number; quantity: number }>,
  barMaps: Map<string, HistoricalBar>[],
  dk: string,
): number {
  let total = 0;
  for (let ai = 0; ai < positions.length; ai++) {
    const pos = positions[ai]!;
    if (!pos.inTrade) continue;
    const bar = barMaps[ai]?.get(dk);
    total += (bar?.close ?? pos.entryPrice) * pos.quantity;
  }
  return total;
}

function computeQty(sizing: PositionSizing, price: number, equity: number): number {
  if (price <= 0) return 0;
  if (sizing.type === "fixed_quantity") return sizing.quantity;
  if (sizing.type === "fixed_dollar") return Math.floor(sizing.amount / price);
  // percent_equity
  return Math.floor((equity * sizing.pct) / 100 / price);
}

function emptyResult(initialCapital: number): PortfolioBacktestResult {
  return {
    totalReturn: 0,
    annualizedReturn: 0,
    sharpeRatio: 0,
    maxDrawdown: 0,
    winRate: 0,
    profitFactor: 0,
    totalTrades: 0,
    trades: [],
    equityCurve: [],
    byAsset: {},
  };
}
