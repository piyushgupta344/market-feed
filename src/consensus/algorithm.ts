/**
 * Pure algorithmic helpers for consensus price calculation.
 * All functions are stateless and easily unit-tested in isolation.
 */

/**
 * Returns normalized weights (sum = 1.0) for the given provider names.
 * If `custom` is provided, those weights are used; missing providers get
 * equal share of the remaining weight.
 */
export function normalizeWeights(
  providers: string[],
  custom?: Record<string, number>,
): Record<string, number> {
  if (providers.length === 0) return {};

  const rawWeights: Record<string, number> = {};
  for (const name of providers) {
    rawWeights[name] = custom?.[name] ?? 1;
  }

  const total = Object.values(rawWeights).reduce((a, b) => a + b, 0);
  const normalized: Record<string, number> = {};
  for (const [name, w] of Object.entries(rawWeights)) {
    normalized[name] = total > 0 ? w / total : 1 / providers.length;
  }
  return normalized;
}

/**
 * Halves the weight of stale providers, then re-normalizes.
 */
export function applyStalenessPenalty(
  weights: Record<string, number>,
  staleProviders: Set<string>,
): Record<string, number> {
  if (staleProviders.size === 0) return weights;

  const adjusted: Record<string, number> = {};
  for (const [name, w] of Object.entries(weights)) {
    adjusted[name] = staleProviders.has(name) ? w * 0.5 : w;
  }

  // Re-normalize
  const total = Object.values(adjusted).reduce((a, b) => a + b, 0);
  const result: Record<string, number> = {};
  for (const [name, w] of Object.entries(adjusted)) {
    result[name] = total > 0 ? w / total : 1 / Object.keys(adjusted).length;
  }
  return result;
}

/**
 * Computes the weighted mean price for the given price and weight maps.
 * Both maps must share the same keys; missing weight defaults to 0.
 */
export function weightedMean(
  prices: Record<string, number>,
  weights: Record<string, number>,
): number {
  let sum = 0;
  let totalWeight = 0;
  for (const [name, price] of Object.entries(prices)) {
    const w = weights[name] ?? 0;
    sum += price * w;
    totalWeight += w;
  }
  return totalWeight > 0 ? sum / totalWeight : 0;
}

/**
 * Returns the set of provider names whose price deviates more than
 * `thresholdPct` percent from the given mean.
 */
export function detectOutliers(
  prices: Record<string, number>,
  mean: number,
  thresholdPct: number,
): Set<string> {
  const outliers = new Set<string>();
  if (mean === 0) return outliers;
  for (const [name, price] of Object.entries(prices)) {
    const deviationPct = (Math.abs(price - mean) / mean) * 100;
    if (deviationPct > thresholdPct) {
      outliers.add(name);
    }
  }
  return outliers;
}

/**
 * Computes a confidence score in [0, 1].
 *
 * Starts at 1.0 and subtracts:
 * - spreadPct / 100  (price disagreement penalty)
 * - 0.1 per stale provider
 * - 0.2 if only a single source responded
 *
 * Result is clamped to [0, 1].
 */
export function computeConfidence(
  spreadPct: number,
  staleCount: number,
  totalCount: number,
  isSingleSource: boolean,
): number {
  let confidence = 1.0;
  confidence -= spreadPct / 100;
  confidence -= staleCount * 0.1;
  if (isSingleSource) confidence -= 0.2;
  // Slight bonus for more providers (up to 0.05)
  confidence += Math.min(0.05, (totalCount - 1) * 0.025);
  return Math.max(0, Math.min(1, confidence));
}
