import type { CompanyProfile } from "../../types/company.js";
import type { DividendEvent } from "../../types/dividends.js";
import type { EarningsEvent } from "../../types/earnings.js";
import type { BalanceSheet, CashFlowStatement, IncomeStatement } from "../../types/fundamentals.js";
import type { HistoricalBar } from "../../types/historical.js";
import type { Quote } from "../../types/quote.js";
import type { SearchResult } from "../../types/search.js";
import type { AssetType } from "../../types/search.js";
import type { SplitEvent } from "../../types/splits.js";
import type {
  YahooBalanceSheet,
  YahooCashFlowStatement,
  YahooChartResult,
  YahooIncomeStatement,
  YahooQuoteSummaryResult,
  YahooSearchQuote,
} from "./types.js";

const PROVIDER = "yahoo";

// ---------------------------------------------------------------------------
// Quote
// ---------------------------------------------------------------------------
export function transformQuote(result: YahooChartResult, raw?: unknown): Quote {
  const meta = result.meta;

  return {
    symbol: meta.symbol,
    name: meta.symbol, // Yahoo chart API doesn't return company name — enriched separately
    price: meta.regularMarketPrice,
    change: meta.regularMarketPrice - meta.regularMarketPreviousClose,
    changePercent:
      ((meta.regularMarketPrice - meta.regularMarketPreviousClose) /
        meta.regularMarketPreviousClose) *
      100,
    open: meta.regularMarketDayHigh, // chart meta has dayHigh/Low not open — see below
    high: meta.regularMarketDayHigh,
    low: meta.regularMarketDayLow,
    close: meta.regularMarketPrice,
    previousClose: meta.regularMarketPreviousClose,
    volume: meta.regularMarketVolume,
    ...(meta.fiftyTwoWeekHigh !== undefined ? { fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh } : {}),
    ...(meta.fiftyTwoWeekLow !== undefined ? { fiftyTwoWeekLow: meta.fiftyTwoWeekLow } : {}),
    currency: meta.currency,
    exchange: meta.fullExchangeName ?? meta.exchangeName,
    timestamp: new Date(meta.regularMarketTime * 1_000),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

// ---------------------------------------------------------------------------
// Historical bars
// ---------------------------------------------------------------------------
export function transformHistorical(result: YahooChartResult, raw?: unknown): HistoricalBar[] {
  const timestamps = result.timestamp ?? [];
  const quoteIndicators = result.indicators.quote[0];
  const adjCloseIndicators = result.indicators.adjclose?.[0];

  if (!quoteIndicators) return [];

  return timestamps
    .map((ts, i) => {
      const open = quoteIndicators.open[i];
      const high = quoteIndicators.high[i];
      const low = quoteIndicators.low[i];
      const close = quoteIndicators.close[i];
      const volume = quoteIndicators.volume[i];
      const adjClose = adjCloseIndicators?.adjclose[i];

      // Skip bars with null/undefined OHLCV (Yahoo returns nulls for non-trading days)
      // Using == null to catch both null and undefined (noUncheckedIndexedAccess)
      if (open == null || high == null || low == null || close == null || volume == null) {
        return null;
      }

      const bar: HistoricalBar = {
        date: new Date(ts * 1_000),
        open,
        high,
        low,
        close,
        volume,
        ...(adjClose !== null && adjClose !== undefined ? { adjClose } : {}),
        ...(raw !== undefined ? { raw } : {}),
      };

      return bar;
    })
    .filter((bar): bar is HistoricalBar => bar !== null);
}

// ---------------------------------------------------------------------------
// Company profile
// ---------------------------------------------------------------------------
export function transformCompany(
  symbol: string,
  result: YahooQuoteSummaryResult,
  raw?: unknown,
): CompanyProfile {
  const profile = result.assetProfile;
  const summary = result.summaryDetail;
  const price = result.price;

  const officers = profile?.companyOfficers ?? [];
  const ceo = officers.find((o) => (o.title ?? "").toLowerCase().includes("chief executive"))?.name;

  return {
    symbol,
    name: price?.longName ?? price?.shortName ?? symbol,
    ...(profile?.longBusinessSummary !== undefined
      ? { description: profile.longBusinessSummary }
      : {}),
    ...(profile?.sector !== undefined ? { sector: profile.sector } : {}),
    ...(profile?.industry !== undefined ? { industry: profile.industry } : {}),
    ...(profile?.country !== undefined ? { country: profile.country } : {}),
    ...(profile?.fullTimeEmployees !== undefined ? { employees: profile.fullTimeEmployees } : {}),
    ...(profile?.website !== undefined ? { website: profile.website } : {}),
    ...(ceo !== undefined ? { ceo } : {}),
    ...(summary?.marketCap?.raw !== undefined ? { marketCap: summary.marketCap.raw } : {}),
    ...(summary?.trailingPE?.raw !== undefined ? { peRatio: summary.trailingPE.raw } : {}),
    ...(summary?.forwardPE?.raw !== undefined ? { forwardPE: summary.forwardPE.raw } : {}),
    ...(summary?.priceToBook?.raw !== undefined ? { priceToBook: summary.priceToBook.raw } : {}),
    ...(summary?.dividendYield?.raw !== undefined
      ? { dividendYield: summary.dividendYield.raw }
      : {}),
    ...(summary?.beta?.raw !== undefined ? { beta: summary.beta.raw } : {}),
    ...(price?.exchangeName !== undefined ? { exchange: price.exchangeName } : {}),
    ...(price?.currency !== undefined
      ? { currency: price.currency }
      : summary?.currency !== undefined
        ? { currency: summary.currency }
        : {}),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

// ---------------------------------------------------------------------------
// Earnings
// ---------------------------------------------------------------------------
export function transformEarnings(
  symbol: string,
  result: YahooQuoteSummaryResult,
  raw?: unknown,
): EarningsEvent[] {
  const history = result.earningsHistory?.history;
  if (!history || history.length === 0) return [];

  return history
    .map((entry) => {
      const ts = entry.quarter?.raw;
      if (ts == null) return null;

      const event: EarningsEvent = {
        symbol,
        date: new Date(ts * 1_000),
        ...(entry.quarter?.fmt !== undefined ? { period: entry.quarter.fmt } : {}),
        ...(entry.epsActual?.raw !== undefined ? { epsActual: entry.epsActual.raw } : {}),
        ...(entry.epsEstimate?.raw !== undefined ? { epsEstimate: entry.epsEstimate.raw } : {}),
        ...(entry.surprisePercent?.raw !== undefined
          ? { epsSurprisePct: entry.surprisePercent.raw }
          : {}),
        provider: PROVIDER,
        ...(raw !== undefined ? { raw } : {}),
      };
      return event;
    })
    .filter((e): e is EarningsEvent => e !== null)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

// ---------------------------------------------------------------------------
// Dividends
// ---------------------------------------------------------------------------
export function transformDividends(
  symbol: string,
  result: YahooChartResult,
  raw?: unknown,
): DividendEvent[] {
  const dividends = result.events?.dividends;
  if (!dividends) return [];

  return Object.values(dividends)
    .map((d) => ({
      symbol,
      exDate: new Date(d.date * 1_000),
      amount: d.amount,
      currency: result.meta.currency,
      provider: PROVIDER,
      ...(raw !== undefined ? { raw } : {}),
    }))
    .sort((a, b) => b.exDate.getTime() - a.exDate.getTime());
}

// ---------------------------------------------------------------------------
// Splits
// ---------------------------------------------------------------------------
export function transformSplits(
  symbol: string,
  result: YahooChartResult,
  raw?: unknown,
): SplitEvent[] {
  const splits = result.events?.splits;
  if (!splits) return [];

  return Object.values(splits)
    .map((s) => ({
      symbol,
      date: new Date(s.date * 1_000),
      ratio: s.denominator > 0 ? s.numerator / s.denominator : s.numerator,
      description: s.splitRatio,
      provider: PROVIDER,
      ...(raw !== undefined ? { raw } : {}),
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
const YAHOO_TYPE_MAP: Record<string, AssetType> = {
  EQUITY: "stock",
  ETF: "etf",
  CRYPTOCURRENCY: "crypto",
  CURRENCY: "forex",
  INDEX: "index",
  MUTUALFUND: "mutual-fund",
  FUTURE: "future",
};

export function transformSearch(quote: YahooSearchQuote, raw?: unknown): SearchResult {
  const exchange = quote.exchDisp ?? quote.exchange;
  return {
    symbol: quote.symbol,
    name: quote.longname ?? quote.shortname ?? quote.symbol,
    type: YAHOO_TYPE_MAP[quote.quoteType?.toUpperCase() ?? ""] ?? "unknown",
    ...(exchange !== undefined ? { exchange } : {}),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

// ---------------------------------------------------------------------------
// Fundamentals
// ---------------------------------------------------------------------------

export function transformIncomeStatement(
  symbol: string,
  entry: YahooIncomeStatement,
  periodType: "annual" | "quarterly",
  raw?: unknown,
): IncomeStatement {
  const rawDate = entry.endDate?.raw;
  return {
    symbol: symbol.toUpperCase(),
    date: rawDate ? new Date(rawDate * 1000) : new Date(0),
    periodType,
    ...(entry.totalRevenue?.raw !== undefined ? { revenue: entry.totalRevenue.raw } : {}),
    ...(entry.costOfRevenue?.raw !== undefined ? { costOfRevenue: entry.costOfRevenue.raw } : {}),
    ...(entry.grossProfit?.raw !== undefined ? { grossProfit: entry.grossProfit.raw } : {}),
    ...(entry.researchDevelopment?.raw !== undefined
      ? { researchAndDevelopment: entry.researchDevelopment.raw }
      : {}),
    ...(entry.sellingGeneralAdministrative?.raw !== undefined
      ? { sellingGeneralAdministrative: entry.sellingGeneralAdministrative.raw }
      : {}),
    ...(entry.totalOperatingExpenses?.raw !== undefined
      ? { totalOperatingExpenses: entry.totalOperatingExpenses.raw }
      : {}),
    ...(entry.operatingIncome?.raw !== undefined
      ? { operatingIncome: entry.operatingIncome.raw }
      : {}),
    ...(entry.netIncome?.raw !== undefined ? { netIncome: entry.netIncome.raw } : {}),
    ...(entry.ebit?.raw !== undefined ? { ebit: entry.ebit.raw } : {}),
    ...(entry.ebitda?.raw !== undefined ? { ebitda: entry.ebitda.raw } : {}),
    ...(entry.dilutedEps?.raw !== undefined ? { dilutedEps: entry.dilutedEps.raw } : {}),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

export function transformBalanceSheet(
  symbol: string,
  entry: YahooBalanceSheet,
  periodType: "annual" | "quarterly",
  raw?: unknown,
): BalanceSheet {
  const rawDate = entry.endDate?.raw;
  return {
    symbol: symbol.toUpperCase(),
    date: rawDate ? new Date(rawDate * 1000) : new Date(0),
    periodType,
    ...(entry.totalAssets?.raw !== undefined ? { totalAssets: entry.totalAssets.raw } : {}),
    ...(entry.totalCurrentAssets?.raw !== undefined
      ? { totalCurrentAssets: entry.totalCurrentAssets.raw }
      : {}),
    ...(entry.totalLiab?.raw !== undefined ? { totalLiabilities: entry.totalLiab.raw } : {}),
    ...(entry.totalCurrentLiabilities?.raw !== undefined
      ? { totalCurrentLiabilities: entry.totalCurrentLiabilities.raw }
      : {}),
    ...(entry.totalStockholderEquity?.raw !== undefined
      ? { totalStockholdersEquity: entry.totalStockholderEquity.raw }
      : {}),
    ...(entry.cash?.raw !== undefined ? { cashAndCashEquivalents: entry.cash.raw } : {}),
    ...(entry.shortTermInvestments?.raw !== undefined
      ? { shortTermInvestments: entry.shortTermInvestments.raw }
      : {}),
    ...(entry.netReceivables?.raw !== undefined
      ? { netReceivables: entry.netReceivables.raw }
      : {}),
    ...(entry.inventory?.raw !== undefined ? { inventory: entry.inventory.raw } : {}),
    ...(entry.shortLongTermDebt?.raw !== undefined
      ? { shortTermDebt: entry.shortLongTermDebt.raw }
      : {}),
    ...(entry.longTermDebt?.raw !== undefined ? { longTermDebt: entry.longTermDebt.raw } : {}),
    ...(entry.totalDebt?.raw !== undefined ? { totalDebt: entry.totalDebt.raw } : {}),
    ...(entry.retainedEarnings?.raw !== undefined
      ? { retainedEarnings: entry.retainedEarnings.raw }
      : {}),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

export function transformCashFlowStatement(
  symbol: string,
  entry: YahooCashFlowStatement,
  periodType: "annual" | "quarterly",
  raw?: unknown,
): CashFlowStatement {
  const rawDate = entry.endDate?.raw;
  const operatingCF = entry.totalCashFromOperatingActivities?.raw;
  const capex = entry.capitalExpenditures?.raw;
  const freeCashFlow =
    operatingCF !== undefined && capex !== undefined ? operatingCF + capex : undefined;

  return {
    symbol: symbol.toUpperCase(),
    date: rawDate ? new Date(rawDate * 1000) : new Date(0),
    periodType,
    ...(operatingCF !== undefined ? { operatingCashFlow: operatingCF } : {}),
    ...(entry.totalCashflowsFromInvestingActivities?.raw !== undefined
      ? { investingCashFlow: entry.totalCashflowsFromInvestingActivities.raw }
      : {}),
    ...(entry.totalCashFromFinancingActivities?.raw !== undefined
      ? { financingCashFlow: entry.totalCashFromFinancingActivities.raw }
      : {}),
    ...(entry.changeInCash?.raw !== undefined ? { netChangeInCash: entry.changeInCash.raw } : {}),
    ...(capex !== undefined ? { capitalExpenditures: capex } : {}),
    ...(freeCashFlow !== undefined ? { freeCashFlow } : {}),
    ...(entry.depreciation?.raw !== undefined ? { depreciation: entry.depreciation.raw } : {}),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}
