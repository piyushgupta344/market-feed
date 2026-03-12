/**
 * market-feed/options
 *
 * Fetch options chains from supported providers (currently Polygon.io).
 *
 * @example
 * ```ts
 * import { getOptionChain } from "market-feed/options";
 * import { PolygonProvider } from "market-feed";
 *
 * const polygon = new PolygonProvider({ apiKey: process.env.POLYGON_KEY! });
 *
 * const chain = await getOptionChain(polygon, "AAPL", {
 *   expiry: "2024-07-19",
 *   strikeLow: 180,
 *   strikeHigh: 220,
 * });
 *
 * console.log(`Calls: ${chain.calls.length}, Puts: ${chain.puts.length}`);
 *
 * for (const contract of chain.calls) {
 *   console.log(
 *     `Strike ${contract.strike}  IV ${contract.impliedVolatility?.toFixed(2)}` +
 *     `  Δ ${contract.delta?.toFixed(3)}`
 *   );
 * }
 * ```
 */

import type { OptionChain, OptionChainOptions } from "../types/options.js";

export type { OptionChain, OptionChainOptions };
export type { OptionContract } from "../types/options.js";

// ---------------------------------------------------------------------------
// Duck-typed source interface
// ---------------------------------------------------------------------------

interface OptionChainSource {
  optionChain(symbol: string, options?: OptionChainOptions): Promise<OptionChain>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch an options chain for a symbol.
 *
 * @param source - Any object with an `optionChain()` method (e.g. `PolygonProvider`, `MarketFeed`)
 * @param symbol - The underlying equity ticker, e.g. "AAPL"
 * @param options - Filters: expiry date, strike range, call/put, limit
 */
export async function getOptionChain(
  source: OptionChainSource,
  symbol: string,
  options?: OptionChainOptions,
): Promise<OptionChain> {
  return source.optionChain(symbol, options);
}
