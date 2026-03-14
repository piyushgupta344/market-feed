export type DividendFrequency = "annual" | "semi-annual" | "quarterly" | "monthly" | "irregular";

export interface DividendEvent {
  symbol: string;
  /** Ex-dividend date — must hold shares before this date to receive the dividend */
  exDate: Date;
  payDate?: Date;
  declaredDate?: Date;
  /** Dividend amount per share */
  amount: number;
  currency: string;
  frequency?: DividendFrequency;
  provider: string;
  raw?: unknown;
}

export interface DividendOptions {
  from?: string | Date;
  to?: string | Date;
  limit?: number;
  raw?: boolean;
}
