export interface EsgScores {
  /** Overall ESG score (0–100, higher is better) */
  totalScore?: number;
  /** Environmental pillar score */
  environmentScore?: number;
  /** Social pillar score */
  socialScore?: number;
  /** Governance pillar score */
  governanceScore?: number;
  /** Percentile rank within the peer group */
  percentile?: number;
  /** Peer group name, e.g. "Technology Hardware" */
  peerGroup?: string;
  /** Performance tier, e.g. "OUT_PERF" | "AVG_PERF" | "UNDER_PERF" | "LAG_PERF" */
  esgPerformance?: string;
}

export interface CompanyProfile {
  symbol: string;
  name: string;
  description?: string;
  sector?: string;
  industry?: string;
  /** ISO 3166-1 alpha-2 country code, e.g. "US" */
  country?: string;
  employees?: number;
  website?: string;
  ceo?: string;
  /** Market cap in USD */
  marketCap?: number;
  /** Price-to-earnings ratio */
  peRatio?: number;
  /** Forward PE ratio */
  forwardPE?: number;
  /** Price-to-book ratio */
  priceToBook?: number;
  /** Annual dividend yield as a decimal, e.g. 0.015 = 1.5% */
  dividendYield?: number;
  /** Beta (5Y monthly) */
  beta?: number;
  /** Exchange identifier */
  exchange?: string;
  /** Currency */
  currency?: string;
  /** IPO date */
  ipoDate?: Date;
  /** ESG scores — populated when available from the provider */
  esg?: EsgScores;
  provider: string;
  raw?: unknown;
}

export interface CompanyOptions {
  raw?: boolean;
}
