export interface FundamentalsOptions {
  /**
   * Whether to include quarterly statements in addition to annual.
   * When `false` (default), only annual statements are returned.
   */
  quarterly?: boolean;
  /** Maximum number of periods to return. Defaults to 4. */
  limit?: number;
  /** Include the raw provider response. */
  raw?: boolean;
}

export interface IncomeStatement {
  symbol: string;
  /** Reporting period end date */
  date: Date;
  /** "annual" or "quarterly" */
  periodType: "annual" | "quarterly";
  revenue?: number;
  costOfRevenue?: number;
  grossProfit?: number;
  researchAndDevelopment?: number;
  sellingGeneralAdministrative?: number;
  totalOperatingExpenses?: number;
  operatingIncome?: number;
  netIncome?: number;
  ebit?: number;
  ebitda?: number;
  eps?: number;
  dilutedEps?: number;
  provider: string;
  raw?: unknown;
}

export interface BalanceSheet {
  symbol: string;
  /** Reporting period end date */
  date: Date;
  /** "annual" or "quarterly" */
  periodType: "annual" | "quarterly";
  totalAssets?: number;
  totalCurrentAssets?: number;
  totalLiabilities?: number;
  totalCurrentLiabilities?: number;
  totalStockholdersEquity?: number;
  cashAndCashEquivalents?: number;
  shortTermInvestments?: number;
  netReceivables?: number;
  inventory?: number;
  shortTermDebt?: number;
  longTermDebt?: number;
  totalDebt?: number;
  retainedEarnings?: number;
  provider: string;
  raw?: unknown;
}

export interface CashFlowStatement {
  symbol: string;
  /** Reporting period end date */
  date: Date;
  /** "annual" or "quarterly" */
  periodType: "annual" | "quarterly";
  operatingCashFlow?: number;
  investingCashFlow?: number;
  financingCashFlow?: number;
  netChangeInCash?: number;
  capitalExpenditures?: number;
  /** operatingCashFlow - capitalExpenditures */
  freeCashFlow?: number;
  depreciation?: number;
  provider: string;
  raw?: unknown;
}
