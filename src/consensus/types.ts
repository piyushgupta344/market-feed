export type ConsensusFlag =
  | "HIGH_DIVERGENCE" // spreadPct > divergenceThreshold
  | "STALE_DATA" // ≥1 provider returned a quote older than stalenessThreshold
  | "SINGLE_SOURCE" // only one provider succeeded
  | "OUTLIER_EXCLUDED"; // ≥1 provider price excluded as a statistical outlier

export interface ProviderContribution {
  /** Price returned by this provider */
  price: number;
  /** Normalized weight actually used in the final weighted mean (0–1) */
  weight: number;
  /** True when the quote timestamp is older than `stalenessThreshold` */
  stale: boolean;
  /** False when the provider was excluded as a price outlier */
  included: boolean;
}

export interface ConsensusResult {
  symbol: string;
  /** Weighted mean price of included, non-outlier providers */
  price: number;
  /** Agreement score: 1.0 = perfect agreement and freshness, 0.0 = maximum divergence */
  confidence: number;
  /** max(prices) − min(prices) across all responding providers */
  spread: number;
  /** (spread / price) × 100 */
  spreadPct: number;
  /** Per-provider breakdown, keyed by provider name */
  providers: Record<string, ProviderContribution>;
  flags: ConsensusFlag[];
  timestamp: Date;
}

export interface ConsensusOptions {
  /**
   * Age (in seconds) after which a quote is considered stale.
   * Stale providers receive half their normal weight.
   * Default: 60
   */
  stalenessThreshold?: number;

  /**
   * Percentage price deviation from the weighted mean beyond which a provider
   * is classified as an outlier and excluded from the final price calculation.
   * Default: 2.0
   */
  divergenceThreshold?: number;

  /**
   * Custom weights keyed by provider name.
   * Will be normalized to sum to 1.0. Unspecified providers get equal share.
   * Example: { yahoo: 2, polygon: 1 } → yahoo gets 2/3, polygon 1/3.
   */
  weights?: Record<string, number>;
}
