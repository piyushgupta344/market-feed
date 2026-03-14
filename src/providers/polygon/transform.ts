import type { CompanyProfile } from "../../types/company.js";
import type { DividendEvent, DividendFrequency } from "../../types/dividends.js";
import type { BalanceSheet, CashFlowStatement, IncomeStatement } from "../../types/fundamentals.js";
import type { HistoricalBar } from "../../types/historical.js";
import type { NewsItem } from "../../types/news.js";
import type { OptionChain, OptionContract } from "../../types/options.js";
import type { Quote } from "../../types/quote.js";
import type { AssetType, SearchResult } from "../../types/search.js";
import type { SplitEvent } from "../../types/splits.js";
import type {
  PolygonAggBar,
  PolygonDividend,
  PolygonFinancialStatement,
  PolygonNewsArticle,
  PolygonOptionSnapshot,
  PolygonSnapshotTicker,
  PolygonSplit,
  PolygonTicker,
  PolygonTickerDetails,
} from "./types.js";

const PROVIDER = "polygon";

// ---------------------------------------------------------------------------
// Quote
// ---------------------------------------------------------------------------
export function transformQuote(ticker: PolygonSnapshotTicker, raw?: unknown): Quote {
  const day = ticker.day;
  const prev = ticker.prevDay;
  const price = ticker.lastTrade?.p ?? day.c;

  return {
    symbol: ticker.ticker,
    name: ticker.ticker,
    price,
    change: ticker.todaysChange,
    changePercent: ticker.todaysChangePerc,
    open: day.o,
    high: day.h,
    low: day.l,
    close: day.c,
    previousClose: prev.c,
    volume: day.v,
    currency: "USD",
    exchange: "",
    timestamp: new Date(ticker.updated / 1_000_000), // nanoseconds → ms
    provider: PROVIDER,
    raw,
  };
}

// ---------------------------------------------------------------------------
// Historical bars
// ---------------------------------------------------------------------------
export function transformHistoricalBar(bar: PolygonAggBar, raw?: unknown): HistoricalBar {
  return {
    date: new Date(bar.t),
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
    ...(raw !== undefined ? { raw } : {}),
  };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
const POLYGON_TYPE_MAP: Record<string, AssetType> = {
  CS: "stock",
  ETF: "etf",
  ETN: "etf",
  ETP: "etf",
  CRYPTO: "crypto",
  FX: "forex",
  CURRENCY: "forex",
  INDEX: "index",
  MF: "mutual-fund",
  FUND: "mutual-fund",
  WARRANT: "unknown",
  RIGHT: "unknown",
  ADRC: "stock",
  PFD: "stock",
};

export function transformSearch(ticker: PolygonTicker, raw?: unknown): SearchResult {
  const type = ticker.type ? (POLYGON_TYPE_MAP[ticker.type.toUpperCase()] ?? "unknown") : "unknown";
  return {
    symbol: ticker.ticker,
    name: ticker.name,
    type,
    ...(ticker.primary_exchange ? { exchange: ticker.primary_exchange } : {}),
    ...(ticker.currency_name ? { currency: ticker.currency_name.toUpperCase() } : {}),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

// ---------------------------------------------------------------------------
// Company profile
// ---------------------------------------------------------------------------
export function transformCompany(details: PolygonTickerDetails, raw?: unknown): CompanyProfile {
  return {
    symbol: details.ticker,
    name: details.name,
    ...(details.description ? { description: details.description } : {}),
    ...(details.sic_description ? { sector: details.sic_description } : {}),
    ...(details.address?.country ? { country: details.address.country } : {}),
    ...(details.total_employees !== undefined ? { employees: details.total_employees } : {}),
    ...(details.homepage_url ? { website: details.homepage_url } : {}),
    ...(details.market_cap !== undefined ? { marketCap: details.market_cap } : {}),
    ...(details.primary_exchange ? { exchange: details.primary_exchange } : {}),
    ...(details.list_date ? { ipoDate: new Date(details.list_date) } : {}),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

// ---------------------------------------------------------------------------
// Dividends
// ---------------------------------------------------------------------------
function toFrequency(n?: number): DividendFrequency | undefined {
  switch (n) {
    case 1:
      return "annual";
    case 2:
      return "semi-annual";
    case 4:
      return "quarterly";
    case 12:
      return "monthly";
    default:
      return n !== undefined ? "irregular" : undefined;
  }
}

export function transformDividend(dividend: PolygonDividend, raw?: unknown): DividendEvent {
  const freq = toFrequency(dividend.frequency);
  return {
    symbol: dividend.ticker,
    exDate: new Date(dividend.ex_dividend_date),
    ...(dividend.pay_date !== undefined ? { payDate: new Date(dividend.pay_date) } : {}),
    ...(dividend.declaration_date !== undefined
      ? { declaredDate: new Date(dividend.declaration_date) }
      : {}),
    amount: dividend.cash_amount,
    currency: dividend.currency ?? "USD",
    ...(freq !== undefined ? { frequency: freq } : {}),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

// ---------------------------------------------------------------------------
// Splits
// ---------------------------------------------------------------------------
export function transformSplit(split: PolygonSplit, raw?: unknown): SplitEvent {
  return {
    symbol: split.ticker,
    date: new Date(split.execution_date),
    ratio: split.split_from > 0 ? split.split_to / split.split_from : split.split_to,
    description: `${split.split_to}:${split.split_from}`,
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

// ---------------------------------------------------------------------------
// Fundamentals helpers
// ---------------------------------------------------------------------------

function val(
  section: Record<string, { value: number }> | undefined,
  key: string,
): number | undefined {
  return section?.[key]?.value;
}

function periodType(timeframe: string): "annual" | "quarterly" {
  return timeframe === "annual" ? "annual" : "quarterly";
}

export function transformIncomeStatement(
  stmt: PolygonFinancialStatement,
  symbol: string,
  raw?: unknown,
): IncomeStatement {
  const is = stmt.financials.income_statement;
  return {
    symbol,
    date: new Date(stmt.end_date),
    periodType: periodType(stmt.timeframe),
    ...(val(is, "revenues") !== undefined ? { revenue: val(is, "revenues") } : {}),
    ...(val(is, "cost_of_revenue") !== undefined
      ? { costOfRevenue: val(is, "cost_of_revenue") }
      : {}),
    ...(val(is, "gross_profit") !== undefined ? { grossProfit: val(is, "gross_profit") } : {}),
    ...(val(is, "research_and_development") !== undefined
      ? { researchAndDevelopment: val(is, "research_and_development") }
      : {}),
    ...(val(is, "selling_general_and_administrative_expenses") !== undefined
      ? {
          sellingGeneralAdministrative: val(is, "selling_general_and_administrative_expenses"),
        }
      : {}),
    ...(val(is, "operating_expenses") !== undefined
      ? { totalOperatingExpenses: val(is, "operating_expenses") }
      : {}),
    ...(val(is, "operating_income_loss") !== undefined
      ? {
          operatingIncome: val(is, "operating_income_loss"),
          ebit: val(is, "operating_income_loss"),
        }
      : {}),
    ...(val(is, "net_income_loss") !== undefined ? { netIncome: val(is, "net_income_loss") } : {}),
    ...(val(is, "basic_earnings_per_share") !== undefined
      ? { eps: val(is, "basic_earnings_per_share") }
      : {}),
    ...(val(is, "diluted_earnings_per_share") !== undefined
      ? { dilutedEps: val(is, "diluted_earnings_per_share") }
      : {}),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

export function transformBalanceSheet(
  stmt: PolygonFinancialStatement,
  symbol: string,
  raw?: unknown,
): BalanceSheet {
  const bs = stmt.financials.balance_sheet;
  return {
    symbol,
    date: new Date(stmt.end_date),
    periodType: periodType(stmt.timeframe),
    ...(val(bs, "assets") !== undefined ? { totalAssets: val(bs, "assets") } : {}),
    ...(val(bs, "current_assets") !== undefined
      ? { totalCurrentAssets: val(bs, "current_assets") }
      : {}),
    ...(val(bs, "liabilities") !== undefined ? { totalLiabilities: val(bs, "liabilities") } : {}),
    ...(val(bs, "current_liabilities") !== undefined
      ? { totalCurrentLiabilities: val(bs, "current_liabilities") }
      : {}),
    ...(val(bs, "equity") !== undefined ? { totalStockholdersEquity: val(bs, "equity") } : {}),
    ...(val(bs, "cash_and_cash_equivalents_and_short_term_investments") !== undefined
      ? {
          cashAndCashEquivalents: val(bs, "cash_and_cash_equivalents_and_short_term_investments"),
        }
      : {}),
    ...(val(bs, "long_term_debt") !== undefined ? { longTermDebt: val(bs, "long_term_debt") } : {}),
    ...(val(bs, "retained_earnings") !== undefined
      ? { retainedEarnings: val(bs, "retained_earnings") }
      : {}),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

export function transformCashFlowStatement(
  stmt: PolygonFinancialStatement,
  symbol: string,
  raw?: unknown,
): CashFlowStatement {
  const cf = stmt.financials.cash_flow_statement;
  const operating = val(cf, "net_cash_flow_from_operating_activities");
  const capEx = val(cf, "capital_expenditure");
  const freeCashFlow =
    operating !== undefined && capEx !== undefined ? operating + capEx : undefined;
  return {
    symbol,
    date: new Date(stmt.end_date),
    periodType: periodType(stmt.timeframe),
    ...(operating !== undefined ? { operatingCashFlow: operating } : {}),
    ...(val(cf, "net_cash_flow_from_investing_activities") !== undefined
      ? { investingCashFlow: val(cf, "net_cash_flow_from_investing_activities") }
      : {}),
    ...(val(cf, "net_cash_flow_from_financing_activities") !== undefined
      ? { financingCashFlow: val(cf, "net_cash_flow_from_financing_activities") }
      : {}),
    ...(val(cf, "net_cash_flow") !== undefined
      ? { netChangeInCash: val(cf, "net_cash_flow") }
      : {}),
    ...(capEx !== undefined ? { capitalExpenditures: capEx } : {}),
    ...(freeCashFlow !== undefined ? { freeCashFlow } : {}),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

// ---------------------------------------------------------------------------
// Options chain
// ---------------------------------------------------------------------------

export function transformOptionContract(
  snap: PolygonOptionSnapshot,
  underlyingSymbol: string,
  raw?: unknown,
): OptionContract {
  const d = snap.details;
  return {
    ticker: d.ticker,
    underlyingSymbol: underlyingSymbol.toUpperCase(),
    type: d.contract_type,
    strike: d.strike_price,
    expiry: new Date(d.expiration_date),
    style: d.exercise_style,
    sharesPerContract: d.shares_per_contract,
    ...(snap.last_quote?.bid !== undefined ? { bid: snap.last_quote.bid } : {}),
    ...(snap.last_quote?.ask !== undefined ? { ask: snap.last_quote.ask } : {}),
    ...(snap.last_quote?.midpoint !== undefined ? { midpoint: snap.last_quote.midpoint } : {}),
    ...(snap.last_trade?.price !== undefined ? { lastPrice: snap.last_trade.price } : {}),
    ...(snap.day?.volume !== undefined ? { volume: snap.day.volume } : {}),
    ...(snap.open_interest !== undefined ? { openInterest: snap.open_interest } : {}),
    ...(snap.implied_volatility !== undefined
      ? { impliedVolatility: snap.implied_volatility }
      : {}),
    ...(snap.greeks?.delta !== undefined ? { delta: snap.greeks.delta } : {}),
    ...(snap.greeks?.gamma !== undefined ? { gamma: snap.greeks.gamma } : {}),
    ...(snap.greeks?.theta !== undefined ? { theta: snap.greeks.theta } : {}),
    ...(snap.greeks?.vega !== undefined ? { vega: snap.greeks.vega } : {}),
    ...(snap.day?.open !== undefined ? { open: snap.day.open } : {}),
    ...(snap.day?.high !== undefined ? { high: snap.day.high } : {}),
    ...(snap.day?.low !== undefined ? { low: snap.day.low } : {}),
    ...(snap.day?.close !== undefined ? { close: snap.day.close } : {}),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}

export function buildOptionChain(
  contracts: OptionContract[],
  underlyingSymbol: string,
): OptionChain {
  return {
    underlyingSymbol: underlyingSymbol.toUpperCase(),
    calls: contracts.filter((c) => c.type === "call"),
    puts: contracts.filter((c) => c.type === "put"),
    fetchedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// News
// ---------------------------------------------------------------------------
export function transformNews(article: PolygonNewsArticle, raw?: unknown): NewsItem {
  return {
    id: article.id,
    title: article.title,
    ...(article.description ? { summary: article.description } : {}),
    url: article.article_url,
    source: article.publisher?.name ?? "unknown",
    publishedAt: new Date(article.published_utc),
    symbols: article.tickers ?? [],
    ...(article.image_url ? { thumbnail: article.image_url } : {}),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}
