import { normalise } from "../utils/symbol.js";
import type { Position, PortfolioSnapshot, PositionSnapshot, QuoteFetcher } from "./types.js";

export type { Position, PortfolioSnapshot, PositionSnapshot, QuoteFetcher } from "./types.js";

/**
 * A mutable collection of positions with real-time P&L via `snapshot()`.
 *
 * @example
 * ```ts
 * import { Portfolio } from "market-feed/portfolio";
 * import { MarketFeed } from "market-feed";
 *
 * const feed = new MarketFeed();
 * const portfolio = new Portfolio([
 *   { symbol: "AAPL", quantity: 10, avgCost: 150.00 },
 *   { symbol: "MSFT", quantity:  5, avgCost: 280.00 },
 * ]);
 *
 * const snap = await portfolio.snapshot(feed);
 * console.log(`Total value:      $${snap.totalMarketValue.toFixed(2)}`);
 * console.log(`Unrealised P&L:   $${snap.totalUnrealizedPnl.toFixed(2)}`);
 * ```
 */
export class Portfolio {
  private readonly _positions = new Map<string, Position>();

  constructor(positions: Position[] = []) {
    for (const p of positions) {
      this._positions.set(normalise(p.symbol), p);
    }
  }

  /**
   * Add or replace a position.
   * If a position for the same symbol already exists it is replaced entirely.
   * Returns `this` for chaining.
   */
  add(position: Position): this {
    this._positions.set(normalise(position.symbol), position);
    return this;
  }

  /**
   * Remove the position for `symbol`. No-op if it doesn't exist.
   * Returns `this` for chaining.
   */
  remove(symbol: string): this {
    this._positions.delete(normalise(symbol));
    return this;
  }

  /** Return the position for `symbol`, or `undefined` if not held. */
  get(symbol: string): Position | undefined {
    return this._positions.get(normalise(symbol));
  }

  /** All positions as a read-only array. */
  list(): readonly Position[] {
    return [...this._positions.values()];
  }

  /** Number of positions in the portfolio. */
  get size(): number {
    return this._positions.size;
  }

  /**
   * Fetch current quotes for all positions and return an enriched snapshot
   * with market values and unrealised P&L.
   *
   * Accepts any object with a `quote(symbols)` method — including `MarketFeed`.
   */
  async snapshot(feed: QuoteFetcher): Promise<PortfolioSnapshot> {
    const positions = this.list();
    if (positions.length === 0) return emptySnapshot();

    const symbols = positions.map((p) => p.symbol);
    const quotes = await feed.quote(symbols);

    // Keyed by normalised symbol for O(1) lookup
    const quoteMap = new Map(quotes.map((q) => [normalise(q.symbol), q]));

    let totalCostBasis = 0;
    let totalMarketValue = 0;
    let totalDayChange = 0;
    const positionSnapshots: PositionSnapshot[] = [];

    for (const position of positions) {
      const quote = quoteMap.get(normalise(position.symbol));
      if (!quote) continue; // provider returned no data for this symbol

      const marketValue = position.quantity * quote.price;
      const costBasis = position.quantity * position.avgCost;
      const unrealizedPnl = marketValue - costBasis;
      const unrealizedPnlPct = costBasis !== 0 ? unrealizedPnl / Math.abs(costBasis) : 0;
      const dayChange = position.quantity * quote.change;
      const dayChangePct = quote.changePercent;

      totalCostBasis += costBasis;
      totalMarketValue += marketValue;
      totalDayChange += dayChange;

      positionSnapshots.push({
        ...position,
        currentPrice: quote.price,
        marketValue,
        costBasis,
        unrealizedPnl,
        unrealizedPnlPct,
        dayChange,
        dayChangePct,
        quote,
      });
    }

    const totalUnrealizedPnl = totalMarketValue - totalCostBasis;
    const totalUnrealizedPnlPct =
      totalCostBasis !== 0 ? totalUnrealizedPnl / Math.abs(totalCostBasis) : 0;

    // Prior-day total market value = current value minus today's change
    const priorDayValue = totalMarketValue - totalDayChange;
    const totalDayChangePct = priorDayValue !== 0 ? totalDayChange / Math.abs(priorDayValue) : 0;

    return {
      positions: positionSnapshots,
      totalCostBasis,
      totalMarketValue,
      totalUnrealizedPnl,
      totalUnrealizedPnlPct,
      totalDayChange,
      totalDayChangePct,
      asOf: new Date(),
    };
  }
}

function emptySnapshot(): PortfolioSnapshot {
  return {
    positions: [],
    totalCostBasis: 0,
    totalMarketValue: 0,
    totalUnrealizedPnl: 0,
    totalUnrealizedPnlPct: 0,
    totalDayChange: 0,
    totalDayChangePct: 0,
    asOf: new Date(),
  };
}
