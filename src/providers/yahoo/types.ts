/**
 * Raw response shapes from the Yahoo Finance v8 chart API and related endpoints.
 * These are intentionally typed as `unknown`-safe so transforms can guard properly.
 */

export interface YahooChartResponse {
  chart: {
    result: YahooChartResult[] | null;
    error: YahooError | null;
  };
}

export interface YahooChartResult {
  meta: YahooChartMeta;
  timestamp?: number[];
  indicators: {
    quote: YahooQuoteIndicator[];
    adjclose?: YahooAdjCloseIndicator[];
  };
  events?: YahooChartEvents;
}

export interface YahooChartEvents {
  dividends?: Record<string, { amount: number; date: number }>;
  splits?: Record<
    string,
    {
      numerator: number;
      denominator: number;
      splitRatio: string;
      date: number;
    }
  >;
}

export interface YahooChartMeta {
  currency: string;
  symbol: string;
  exchangeName: string;
  fullExchangeName?: string;
  instrumentType: string;
  firstTradeDate: number | null;
  regularMarketTime: number;
  hasPrePostMarketData: boolean;
  gmtoffset: number;
  timezone: string;
  exchangeTimezoneName: string;
  regularMarketPrice: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  regularMarketVolume: number;
  regularMarketPreviousClose: number;
  chartPreviousClose?: number;
  priceHint: number;
  currentTradingPeriod: {
    pre: YahooTradingPeriod;
    regular: YahooTradingPeriod;
    post: YahooTradingPeriod;
  };
  dataGranularity: string;
  range: string;
  validRanges: string[];
}

export interface YahooTradingPeriod {
  timezone: string;
  start: number;
  end: number;
  gmtoffset: number;
}

export interface YahooQuoteIndicator {
  open: (number | null)[];
  high: (number | null)[];
  low: (number | null)[];
  close: (number | null)[];
  volume: (number | null)[];
}

export interface YahooAdjCloseIndicator {
  adjclose: (number | null)[];
}

// ---------------------------------------------------------------------------
// Quote summary (for company profile)
// ---------------------------------------------------------------------------
export interface YahooQuoteSummaryResponse {
  quoteSummary: {
    result: YahooQuoteSummaryResult[] | null;
    error: YahooError | null;
  };
}

export interface YahooEsgScoresModule {
  totalEsg?: { raw?: number };
  environmentScore?: { raw?: number };
  socialScore?: { raw?: number };
  governanceScore?: { raw?: number };
  percentile?: { raw?: number };
  peerGroup?: string;
  esgPerformance?: string;
}

export interface YahooQuoteSummaryResult {
  assetProfile?: YahooAssetProfile;
  summaryDetail?: YahooSummaryDetail;
  price?: YahooPriceModule;
  esgScores?: YahooEsgScoresModule;
  earningsHistory?: YahooEarningsHistoryModule;
  incomeStatementHistory?: YahooIncomeStatementHistoryModule;
  incomeStatementHistoryQuarterly?: YahooIncomeStatementHistoryModule;
  balanceSheetHistory?: YahooBalanceSheetHistoryModule;
  balanceSheetHistoryQuarterly?: YahooBalanceSheetHistoryModule;
  cashflowStatementHistory?: YahooCashflowStatementHistoryModule;
  cashflowStatementHistoryQuarterly?: YahooCashflowStatementHistoryModule;
}

export interface YahooEarningsHistoryModule {
  history?: YahooEarningsHistoryEntry[];
}

export interface YahooEarningsHistoryEntry {
  epsActual?: { raw?: number };
  epsEstimate?: { raw?: number };
  epsDifference?: { raw?: number };
  surprisePercent?: { raw?: number };
  /** Human-readable period label, e.g. "-3q" — not useful as a label */
  period?: string;
  /** Quarter-end date as Unix epoch seconds */
  quarter?: { raw?: number; fmt?: string };
}

export interface YahooAssetProfile {
  longBusinessSummary?: string;
  sector?: string;
  industry?: string;
  country?: string;
  fullTimeEmployees?: number;
  website?: string;
  companyOfficers?: Array<{ name?: string; title?: string }>;
}

export interface YahooSummaryDetail {
  currency?: string;
  marketCap?: { raw?: number };
  trailingPE?: { raw?: number };
  forwardPE?: { raw?: number };
  priceToBook?: { raw?: number };
  dividendYield?: { raw?: number };
  beta?: { raw?: number };
}

export interface YahooPriceModule {
  longName?: string;
  shortName?: string;
  symbol?: string;
  exchangeName?: string;
  currency?: string;
}

// ---------------------------------------------------------------------------
// Fundamentals — shared number wrapper
// ---------------------------------------------------------------------------
export interface YahooNumberValue {
  raw?: number;
  fmt?: string;
  longFmt?: string;
}

export interface YahooDateValue {
  raw?: number;
  fmt?: string;
}

export interface YahooIncomeStatement {
  endDate?: YahooDateValue;
  totalRevenue?: YahooNumberValue;
  costOfRevenue?: YahooNumberValue;
  grossProfit?: YahooNumberValue;
  researchDevelopment?: YahooNumberValue;
  sellingGeneralAdministrative?: YahooNumberValue;
  totalOperatingExpenses?: YahooNumberValue;
  operatingIncome?: YahooNumberValue;
  netIncome?: YahooNumberValue;
  ebit?: YahooNumberValue;
  ebitda?: YahooNumberValue;
  dilutedEps?: YahooNumberValue;
}

export interface YahooIncomeStatementHistoryModule {
  incomeStatementHistory?: YahooIncomeStatement[];
}

export interface YahooBalanceSheet {
  endDate?: YahooDateValue;
  totalAssets?: YahooNumberValue;
  totalCurrentAssets?: YahooNumberValue;
  totalLiab?: YahooNumberValue;
  totalCurrentLiabilities?: YahooNumberValue;
  totalStockholderEquity?: YahooNumberValue;
  cash?: YahooNumberValue;
  shortTermInvestments?: YahooNumberValue;
  netReceivables?: YahooNumberValue;
  inventory?: YahooNumberValue;
  shortLongTermDebt?: YahooNumberValue;
  longTermDebt?: YahooNumberValue;
  totalDebt?: YahooNumberValue;
  retainedEarnings?: YahooNumberValue;
}

export interface YahooBalanceSheetHistoryModule {
  balanceSheetStatements?: YahooBalanceSheet[];
}

export interface YahooCashFlowStatement {
  endDate?: YahooDateValue;
  totalCashFromOperatingActivities?: YahooNumberValue;
  totalCashflowsFromInvestingActivities?: YahooNumberValue;
  totalCashFromFinancingActivities?: YahooNumberValue;
  changeInCash?: YahooNumberValue;
  capitalExpenditures?: YahooNumberValue;
  depreciation?: YahooNumberValue;
}

export interface YahooCashflowStatementHistoryModule {
  cashflowStatements?: YahooCashFlowStatement[];
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
export interface YahooSearchResponse {
  quotes: YahooSearchQuote[];
  news?: unknown[];
}

export interface YahooSearchQuote {
  symbol: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  exchange?: string;
  exchDisp?: string;
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------
export interface YahooError {
  code: string;
  description: string;
}
