export type AssetType =
  | "stock"
  | "etf"
  | "crypto"
  | "forex"
  | "index"
  | "mutual-fund"
  | "future"
  | "unknown";

export interface SearchResult {
  symbol: string;
  name: string;
  type: AssetType;
  exchange?: string;
  currency?: string;
  /** ISIN when available */
  isin?: string;
  provider: string;
  raw?: unknown;
}

export interface SearchOptions {
  /** Maximum number of results to return. Defaults to 10. */
  limit?: number;
  raw?: boolean;
}
