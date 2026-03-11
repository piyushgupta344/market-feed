export interface SplitEvent {
  symbol: string;
  date: Date;
  /**
   * Split ratio as a decimal.
   * A 4-for-1 forward split → ratio = 4.
   * A 1-for-10 reverse split → ratio = 0.1.
   */
  ratio: number;
  /** Human-readable description, e.g. "4:1" */
  description?: string;
  provider: string;
  raw?: unknown;
}

export interface SplitOptions {
  from?: string | Date;
  to?: string | Date;
  limit?: number;
  raw?: boolean;
}
