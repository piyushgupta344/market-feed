/**
 * market-feed/fundamentals
 *
 * Exports structured financial statement types and a `getFundamentals()`
 * convenience function that fetches all three statements in one call.
 *
 * @example
 * ```ts
 * import { getFundamentals } from "market-feed/fundamentals";
 * import { MarketFeed } from "market-feed";
 *
 * const feed = new MarketFeed();
 * const { incomeStatements, balanceSheets, cashFlows } = await getFundamentals(feed, "AAPL");
 * console.log(incomeStatements[0]?.revenue);
 * ```
 */
export type {
  BalanceSheet,
  CashFlowStatement,
  FundamentalsOptions,
  IncomeStatement,
} from "../types/fundamentals.js";

import type {
  BalanceSheet,
  CashFlowStatement,
  FundamentalsOptions,
  IncomeStatement,
} from "../types/fundamentals.js";

/** Minimal duck-type interface for the feed/provider expected by getFundamentals() */
interface FundamentalsSource {
  incomeStatements?(symbol: string, options?: FundamentalsOptions): Promise<IncomeStatement[]>;
  balanceSheets?(symbol: string, options?: FundamentalsOptions): Promise<BalanceSheet[]>;
  cashFlows?(symbol: string, options?: FundamentalsOptions): Promise<CashFlowStatement[]>;
}

export interface FundamentalsResult {
  symbol: string;
  incomeStatements: IncomeStatement[];
  balanceSheets: BalanceSheet[];
  cashFlows: CashFlowStatement[];
}

/**
 * Fetch all three financial statements for a symbol in a single call.
 *
 * Uses `Promise.allSettled` so a partial failure on one statement
 * still returns the others. Failed statements resolve to `[]`.
 *
 * @example
 * ```ts
 * import { getFundamentals } from "market-feed/fundamentals";
 * import { MarketFeed } from "market-feed";
 *
 * const feed = new MarketFeed();
 * const { incomeStatements, balanceSheets, cashFlows } = await getFundamentals(feed, "AAPL");
 * ```
 */
export async function getFundamentals(
  source: FundamentalsSource,
  symbol: string,
  options?: FundamentalsOptions,
): Promise<FundamentalsResult> {
  const [incomeResult, balanceResult, cashResult] = await Promise.allSettled([
    source.incomeStatements ? source.incomeStatements(symbol, options) : Promise.resolve([]),
    source.balanceSheets ? source.balanceSheets(symbol, options) : Promise.resolve([]),
    source.cashFlows ? source.cashFlows(symbol, options) : Promise.resolve([]),
  ]);

  return {
    symbol: symbol.toUpperCase(),
    incomeStatements: incomeResult.status === "fulfilled" ? incomeResult.value : [],
    balanceSheets: balanceResult.status === "fulfilled" ? balanceResult.value : [],
    cashFlows: cashResult.status === "fulfilled" ? cashResult.value : [],
  };
}
