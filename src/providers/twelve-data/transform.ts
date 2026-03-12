import type { CompanyProfile } from "../../types/company.js";
import type { BalanceSheet, CashFlowStatement, IncomeStatement } from "../../types/fundamentals.js";
import type { HistoricalBar } from "../../types/historical.js";
import type { Quote } from "../../types/quote.js";
import type { AssetType, SearchResult } from "../../types/search.js";
import type {
  TwelveDataBalanceSheetPeriod,
  TwelveDataCashFlowPeriod,
  TwelveDataIncomeStatementPeriod,
  TwelveDataProfileResponse,
  TwelveDataQuoteResponse,
  TwelveDataSearchResult,
  TwelveDataTimeSeriesBar,
} from "./types.js";

const PROVIDER = "twelve-data";

export function transformQuote(data: TwelveDataQuoteResponse, raw?: unknown): Quote {
  return {
    symbol: data.symbol,
    name: data.name,
    price: Number(data.close),
    change: Number(data.change),
    changePercent: Number(data.percent_change),
    open: Number(data.open),
    high: Number(data.high),
    low: Number(data.low),
    close: Number(data.close),
    previousClose: Number(data.previous_close),
    volume: Number(data.volume),
    ...(data.average_volume !== undefined ? { avgVolume: Number(data.average_volume) } : {}),
    ...(data.fifty_two_week !== undefined
      ? {
          fiftyTwoWeekHigh: Number(data.fifty_two_week.high),
          fiftyTwoWeekLow: Number(data.fifty_two_week.low),
        }
      : {}),
    currency: data.currency,
    exchange: data.exchange,
    timestamp: new Date(data.timestamp * 1000),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

export function transformHistoricalBar(bar: TwelveDataTimeSeriesBar, raw?: unknown): HistoricalBar {
  return {
    date: new Date(bar.datetime),
    open: Number(bar.open),
    high: Number(bar.high),
    low: Number(bar.low),
    close: Number(bar.close),
    volume: Number(bar.volume),
    ...(raw !== undefined ? { raw } : {}),
  };
}

export function transformSearch(result: TwelveDataSearchResult, raw?: unknown): SearchResult {
  return {
    symbol: result.symbol,
    name: result.instrument_name,
    type: mapInstrumentType(result.instrument_type),
    exchange: result.exchange || undefined,
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

export function transformProfile(data: TwelveDataProfileResponse, raw?: unknown): CompanyProfile {
  return {
    symbol: data.symbol,
    name: data.name,
    description: data.description || undefined,
    sector: data.sector || undefined,
    industry: data.industry || undefined,
    country: data.country || undefined,
    employees: data.employees || undefined,
    website: data.website || undefined,
    ceo: data.CEO || undefined,
    exchange: data.exchange || undefined,
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

// ---------------------------------------------------------------------------
// Fundamentals
// ---------------------------------------------------------------------------

function numStr(val: string | undefined): number | undefined {
  if (val === undefined || val === null || val === "") return undefined;
  const n = Number(val);
  return Number.isNaN(n) ? undefined : n;
}

export function transformIncomeStatement(
  period: TwelveDataIncomeStatementPeriod,
  symbol: string,
  periodType: "annual" | "quarterly",
  raw?: unknown,
): IncomeStatement {
  return {
    symbol,
    date: new Date(period.fiscal_date),
    periodType,
    ...(numStr(period.revenue) !== undefined ? { revenue: numStr(period.revenue) } : {}),
    ...(numStr(period.cost_of_revenue) !== undefined
      ? { costOfRevenue: numStr(period.cost_of_revenue) }
      : {}),
    ...(numStr(period.gross_profit) !== undefined
      ? { grossProfit: numStr(period.gross_profit) }
      : {}),
    ...(numStr(period.research_and_development) !== undefined
      ? { researchAndDevelopment: numStr(period.research_and_development) }
      : {}),
    ...(numStr(period.selling_general_and_administrative) !== undefined
      ? { sellingGeneralAdministrative: numStr(period.selling_general_and_administrative) }
      : {}),
    ...(numStr(period.operating_expenses) !== undefined
      ? { totalOperatingExpenses: numStr(period.operating_expenses) }
      : {}),
    ...(numStr(period.operating_income) !== undefined
      ? { operatingIncome: numStr(period.operating_income) }
      : {}),
    ...(numStr(period.ebit) !== undefined ? { ebit: numStr(period.ebit) } : {}),
    ...(numStr(period.ebitda) !== undefined ? { ebitda: numStr(period.ebitda) } : {}),
    ...(numStr(period.net_income) !== undefined ? { netIncome: numStr(period.net_income) } : {}),
    ...(numStr(period.eps_basic) !== undefined ? { eps: numStr(period.eps_basic) } : {}),
    ...(numStr(period.eps_diluted) !== undefined ? { dilutedEps: numStr(period.eps_diluted) } : {}),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

export function transformBalanceSheet(
  period: TwelveDataBalanceSheetPeriod,
  symbol: string,
  periodType: "annual" | "quarterly",
  raw?: unknown,
): BalanceSheet {
  return {
    symbol,
    date: new Date(period.fiscal_date),
    periodType,
    ...(numStr(period.total_assets) !== undefined
      ? { totalAssets: numStr(period.total_assets) }
      : {}),
    ...(numStr(period.total_current_assets) !== undefined
      ? { totalCurrentAssets: numStr(period.total_current_assets) }
      : {}),
    ...(numStr(period.total_liabilities) !== undefined
      ? { totalLiabilities: numStr(period.total_liabilities) }
      : {}),
    ...(numStr(period.total_current_liabilities) !== undefined
      ? { totalCurrentLiabilities: numStr(period.total_current_liabilities) }
      : {}),
    ...(numStr(period.total_equity) !== undefined
      ? { totalStockholdersEquity: numStr(period.total_equity) }
      : {}),
    ...(numStr(period.cash_and_cash_equivalents) !== undefined
      ? { cashAndCashEquivalents: numStr(period.cash_and_cash_equivalents) }
      : {}),
    ...(numStr(period.short_term_investments) !== undefined
      ? { shortTermInvestments: numStr(period.short_term_investments) }
      : {}),
    ...(numStr(period.net_receivables) !== undefined
      ? { netReceivables: numStr(period.net_receivables) }
      : {}),
    ...(numStr(period.inventory) !== undefined ? { inventory: numStr(period.inventory) } : {}),
    ...(numStr(period.short_term_debt) !== undefined
      ? { shortTermDebt: numStr(period.short_term_debt) }
      : {}),
    ...(numStr(period.long_term_debt) !== undefined
      ? { longTermDebt: numStr(period.long_term_debt) }
      : {}),
    ...(numStr(period.total_debt) !== undefined ? { totalDebt: numStr(period.total_debt) } : {}),
    ...(numStr(period.retained_earnings) !== undefined
      ? { retainedEarnings: numStr(period.retained_earnings) }
      : {}),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

export function transformCashFlowStatement(
  period: TwelveDataCashFlowPeriod,
  symbol: string,
  periodType: "annual" | "quarterly",
  raw?: unknown,
): CashFlowStatement {
  return {
    symbol,
    date: new Date(period.fiscal_date),
    periodType,
    ...(numStr(period.operating_activities) !== undefined
      ? { operatingCashFlow: numStr(period.operating_activities) }
      : {}),
    ...(numStr(period.investing_activities) !== undefined
      ? { investingCashFlow: numStr(period.investing_activities) }
      : {}),
    ...(numStr(period.financing_activities) !== undefined
      ? { financingCashFlow: numStr(period.financing_activities) }
      : {}),
    ...(numStr(period.net_change_in_cash) !== undefined
      ? { netChangeInCash: numStr(period.net_change_in_cash) }
      : {}),
    ...(numStr(period.capital_expenditure) !== undefined
      ? { capitalExpenditures: numStr(period.capital_expenditure) }
      : {}),
    ...(numStr(period.free_cash_flow) !== undefined
      ? { freeCashFlow: numStr(period.free_cash_flow) }
      : {}),
    ...(numStr(period.depreciation_and_amortization) !== undefined
      ? { depreciation: numStr(period.depreciation_and_amortization) }
      : {}),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

function mapInstrumentType(type: string): AssetType {
  const t = type.toLowerCase();
  if (t.includes("common stock") || t === "cs") return "stock";
  if (t.includes("etf") || t.includes("exchange traded fund")) return "etf";
  if (t.includes("crypto")) return "crypto";
  if (t.includes("forex") || t.includes("currency")) return "forex";
  if (t.includes("mutual fund") || t.includes("fund")) return "mutual-fund";
  if (t.includes("future")) return "future";
  if (t.includes("index")) return "index";
  return "unknown";
}
