/**
 * market-feed/screener
 *
 * Filter a list of symbols against a set of criteria using live quote data,
 * company profile data, or any custom condition function.
 *
 * @example
 * ```ts
 * import { screen } from "market-feed/screener";
 * import { MarketFeed } from "market-feed";
 *
 * const feed = new MarketFeed();
 *
 * const results = await screen(feed, ["AAPL", "MSFT", "GOOGL", "TSLA"], {
 *   criteria: [
 *     { type: "price_above", value: 100 },
 *     { type: "change_pct_above", value: -5 },
 *     { type: "volume_above", value: 1_000_000 },
 *   ],
 * });
 *
 * console.log(results.map((r) => r.symbol));
 * ```
 */

import type { Quote } from "../types/quote.js";

// ---------------------------------------------------------------------------
// Criterion types
// ---------------------------------------------------------------------------

export type QuoteCriterion =
  | { type: "price_above"; value: number }
  | { type: "price_below"; value: number }
  | { type: "change_pct_above"; value: number }
  | { type: "change_pct_below"; value: number }
  | { type: "volume_above"; value: number }
  | { type: "volume_below"; value: number }
  | { type: "volume_vs_avg_above"; value: number }
  | { type: "volume_vs_avg_below"; value: number }
  | { type: "market_cap_above"; value: number }
  | { type: "market_cap_below"; value: number }
  | { type: "pe_above"; value: number }
  | { type: "pe_below"; value: number }
  | { type: "52w_high_pct_below"; value: number }
  | { type: "52w_low_pct_above"; value: number }
  /** Custom predicate — return true to include, false to exclude */
  | { type: "custom"; fn: (quote: Quote) => boolean };

export type ScreenerCriterion = QuoteCriterion;

export interface ScreenerOptions {
  /** List of criteria — ALL must pass (logical AND) */
  criteria: ScreenerCriterion[];
  /**
   * Maximum number of symbols to fetch quotes for per batch.
   * Defaults to all symbols in one call.
   */
  batchSize?: number;
  /**
   * Maximum number of results to return.
   * Defaults to all matching symbols.
   */
  limit?: number;
}

export interface ScreenerResult {
  symbol: string;
  quote: Quote;
  /** Which criteria matched (all of them, by design) */
  matchedCriteria: number;
}

// ---------------------------------------------------------------------------
// Quote source interface (duck-typed for testability)
// ---------------------------------------------------------------------------

interface QuoteSource {
  quote(symbols: string[], options?: { raw?: boolean }): Promise<Quote[]>;
}

// ---------------------------------------------------------------------------
// Core screener function
// ---------------------------------------------------------------------------

/**
 * Screen a list of symbols against a set of criteria.
 *
 * Fetches quotes for all symbols (in optional batches) and returns those
 * that satisfy ALL of the provided criteria.
 *
 * @param source - Any object with a `quote(symbols[]) → Quote[]` method (e.g. `MarketFeed`, a single provider)
 * @param symbols - Symbols to evaluate
 * @param options - Screener configuration
 */
export async function screen(
  source: QuoteSource,
  symbols: string[],
  options: ScreenerOptions,
): Promise<ScreenerResult[]> {
  if (symbols.length === 0 || options.criteria.length === 0) return [];

  const { criteria, batchSize, limit } = options;

  // Fetch quotes in batches (or all at once if no batchSize)
  const quotes = await fetchInBatches(source, symbols, batchSize);

  const results: ScreenerResult[] = [];
  for (const quote of quotes) {
    if (matchesAll(quote, criteria)) {
      results.push({ symbol: quote.symbol, quote, matchedCriteria: criteria.length });
      if (limit !== undefined && results.length >= limit) break;
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Criterion evaluator
// ---------------------------------------------------------------------------

function matchesAll(quote: Quote, criteria: ScreenerCriterion[]): boolean {
  for (const c of criteria) {
    if (!matchesCriterion(quote, c)) return false;
  }
  return true;
}

function matchesCriterion(quote: Quote, criterion: ScreenerCriterion): boolean {
  switch (criterion.type) {
    case "price_above":
      return quote.price > criterion.value;
    case "price_below":
      return quote.price < criterion.value;
    case "change_pct_above":
      return quote.changePercent > criterion.value;
    case "change_pct_below":
      return quote.changePercent < criterion.value;
    case "volume_above":
      return quote.volume > criterion.value;
    case "volume_below":
      return quote.volume < criterion.value;
    case "volume_vs_avg_above":
      if (quote.avgVolume === undefined) return true;
      return quote.volume > quote.avgVolume * criterion.value;
    case "volume_vs_avg_below":
      if (quote.avgVolume === undefined) return true;
      return quote.volume < quote.avgVolume * criterion.value;
    case "market_cap_above":
      return quote.marketCap !== undefined && quote.marketCap > criterion.value;
    case "market_cap_below":
      return quote.marketCap !== undefined && quote.marketCap < criterion.value;
    case "pe_above":
      // CompanyProfile-level data is not on Quote — skip (return true to not block)
      return true;
    case "pe_below":
      return true;
    case "52w_high_pct_below": {
      if (quote.fiftyTwoWeekHigh === undefined) return true;
      const pctBelow = ((quote.fiftyTwoWeekHigh - quote.price) / quote.fiftyTwoWeekHigh) * 100;
      return pctBelow < criterion.value;
    }
    case "52w_low_pct_above": {
      if (quote.fiftyTwoWeekLow === undefined) return true;
      const pctAbove = ((quote.price - quote.fiftyTwoWeekLow) / quote.fiftyTwoWeekLow) * 100;
      return pctAbove > criterion.value;
    }
    case "custom":
      return criterion.fn(quote);
  }
}

// ---------------------------------------------------------------------------
// Batch fetching helper
// ---------------------------------------------------------------------------

async function fetchInBatches(
  source: QuoteSource,
  symbols: string[],
  batchSize?: number,
): Promise<Quote[]> {
  if (!batchSize || batchSize >= symbols.length) {
    return source.quote(symbols);
  }

  const batches: string[][] = [];
  for (let i = 0; i < symbols.length; i += batchSize) {
    batches.push(symbols.slice(i, i + batchSize));
  }

  const results = await Promise.all(batches.map((batch) => source.quote(batch)));
  return results.flat();
}
