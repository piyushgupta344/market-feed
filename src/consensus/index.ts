import { AllProvidersFailedError, MarketFeedError } from "../errors.js";
import type { MarketProvider } from "../types/provider.js";
import {
  applyStalenessPenalty,
  computeConfidence,
  detectOutliers,
  normalizeWeights,
  weightedMean,
} from "./algorithm.js";
import type { ConsensusFlag, ConsensusOptions, ConsensusResult } from "./types.js";

export type {
  ConsensusResult,
  ConsensusOptions,
  ConsensusFlag,
  ProviderContribution,
} from "./types.js";

export {
  normalizeWeights,
  applyStalenessPenalty,
  weightedMean,
  detectOutliers,
  computeConfidence,
} from "./algorithm.js";

/**
 * Queries all providers simultaneously for a single symbol and combines
 * their responses into a statistically-weighted consensus price.
 *
 * Unlike `MarketFeed.quote()` which stops at the first successful provider,
 * `consensus()` collects results from all providers and uses them together.
 *
 * @example
 * ```ts
 * import { consensus } from 'market-feed/consensus';
 *
 * const feed = new MarketFeed({
 *   providers: [new YahooProvider(), new PolygonProvider({ apiKey: '...' })],
 * });
 *
 * const result = await consensus(feed.providers, 'AAPL');
 * console.log(result.price);       // weighted mean
 * console.log(result.confidence);  // 0–1
 * console.log(result.flags);       // ["STALE_DATA"] etc.
 * ```
 */
export async function consensus(
  providers: readonly MarketProvider[],
  symbol: string,
  options: ConsensusOptions = {},
): Promise<ConsensusResult> {
  if (providers.length === 0) {
    throw new AllProvidersFailedError([], `consensus:${symbol}`);
  }

  const stalenessThresholdMs = (options.stalenessThreshold ?? 60) * 1_000;
  const divergenceThreshold = options.divergenceThreshold ?? 2.0;

  // -------------------------------------------------------------------------
  // 1. Query all providers simultaneously — never fail-fast
  // -------------------------------------------------------------------------
  const settled = await Promise.allSettled(providers.map((p) => p.quote([symbol])));

  interface ProviderResult {
    name: string;
    price: number;
    timestampMs: number;
  }

  const successes: ProviderResult[] = [];
  const failures: MarketFeedError[] = [];

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    const provider = providers[i];
    if (!result || !provider) continue;

    if (result.status === "fulfilled") {
      const quote = result.value[0];
      if (quote !== undefined) {
        successes.push({
          name: provider.name,
          price: quote.price,
          timestampMs: quote.timestamp.getTime(),
        });
      }
    } else {
      const err = result.reason;
      failures.push(
        err instanceof MarketFeedError ? err : new MarketFeedError(String(err), provider.name),
      );
    }
  }

  if (successes.length === 0) {
    throw new AllProvidersFailedError(failures, `consensus:${symbol}`);
  }

  const flags: ConsensusFlag[] = [];
  const now = Date.now();

  // -------------------------------------------------------------------------
  // 2. Staleness check
  // -------------------------------------------------------------------------
  const staleSet = new Set<string>();
  for (const { name, timestampMs } of successes) {
    if (now - timestampMs > stalenessThresholdMs) {
      staleSet.add(name);
    }
  }
  if (staleSet.size > 0) flags.push("STALE_DATA");
  if (successes.length === 1) flags.push("SINGLE_SOURCE");

  // -------------------------------------------------------------------------
  // 3. Build price map and initial weighted mean
  // -------------------------------------------------------------------------
  const names = successes.map((s) => s.name);
  const prices: Record<string, number> = {};
  for (const { name, price } of successes) prices[name] = price;

  // -------------------------------------------------------------------------
  // 4. Outlier detection (use median — more robust than weighted mean for N≤5)
  // -------------------------------------------------------------------------
  const sortedPrices = Object.values(prices).sort((a, b) => a - b);
  const mid = Math.floor(sortedPrices.length / 2);
  const medianPrice =
    sortedPrices.length % 2 === 0
      ? ((sortedPrices[mid - 1] ?? 0) + (sortedPrices[mid] ?? 0)) / 2
      : (sortedPrices[mid] ?? 0);

  const outliers = detectOutliers(prices, medianPrice, divergenceThreshold);
  if (outliers.size > 0) flags.push("OUTLIER_EXCLUDED");

  const includedNames = names.filter((n) => !outliers.has(n));
  const includedPrices: Record<string, number> = {};
  for (const n of includedNames) {
    const p = prices[n];
    if (p !== undefined) includedPrices[n] = p;
  }

  const finalBaseWeights = normalizeWeights(includedNames, options.weights);
  const finalWeights = applyStalenessPenalty(finalBaseWeights, staleSet);
  const finalPrice = weightedMean(includedPrices, finalWeights);

  // -------------------------------------------------------------------------
  // 5. Spread (across ALL providers, not just included)
  // -------------------------------------------------------------------------
  const allPrices = Object.values(prices);
  const spread = Math.max(...allPrices) - Math.min(...allPrices);
  const spreadPct = finalPrice > 0 ? (spread / finalPrice) * 100 : 0;
  if (spreadPct > divergenceThreshold) flags.push("HIGH_DIVERGENCE");

  // -------------------------------------------------------------------------
  // 6. Confidence score
  // -------------------------------------------------------------------------
  const confidence = computeConfidence(
    spreadPct,
    staleSet.size,
    successes.length,
    successes.length === 1,
  );

  // -------------------------------------------------------------------------
  // 7. Build provider contribution map
  // -------------------------------------------------------------------------
  const providerContributions: ConsensusResult["providers"] = {};
  for (const { name } of successes) {
    providerContributions[name] = {
      price: prices[name] ?? 0,
      weight: finalWeights[name] ?? 0,
      stale: staleSet.has(name),
      included: !outliers.has(name),
    };
  }

  return {
    symbol,
    price: finalPrice,
    confidence,
    spread,
    spreadPct,
    providers: providerContributions,
    flags,
    timestamp: new Date(),
  };
}
