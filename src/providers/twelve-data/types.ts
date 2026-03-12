export interface TwelveDataQuoteResponse {
  symbol: string;
  name: string;
  exchange: string;
  mic_code: string;
  currency: string;
  /** "YYYY-MM-DD" */
  datetime: string;
  /** Unix seconds */
  timestamp: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  previous_close: string;
  change: string;
  percent_change: string;
  average_volume?: string;
  is_market_open?: boolean;
  fifty_two_week?: {
    low: string;
    high: string;
    low_change: string;
    high_change: string;
    low_change_percent: string;
    high_change_percent: string;
    range: string;
  };
  /** Present on error responses */
  code?: number;
  status?: string;
  message?: string;
}

export interface TwelveDataTimeSeriesBar {
  /** "YYYY-MM-DD" for daily, "YYYY-MM-DD HH:MM:SS" for intraday */
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export interface TwelveDataTimeSeriesResponse {
  meta: {
    symbol: string;
    interval: string;
    currency: string;
    exchange_timezone: string;
    exchange: string;
    mic_code: string;
    type: string;
  };
  values: TwelveDataTimeSeriesBar[];
  status: string;
  code?: number;
  message?: string;
}

export interface TwelveDataSearchResult {
  symbol: string;
  instrument_name: string;
  exchange: string;
  mic_code: string;
  exchange_timezone: string;
  /** e.g. "Common Stock", "ETF", "Cryptocurrency", "Forex" */
  instrument_type: string;
  country: string;
  currency: string;
}

export interface TwelveDataSearchResponse {
  data: TwelveDataSearchResult[];
  status: string;
  code?: number;
  message?: string;
}

export interface TwelveDataProfileResponse {
  symbol: string;
  name: string;
  exchange: string;
  mic_code?: string;
  sector?: string;
  industry?: string;
  employees?: number;
  website?: string;
  description?: string;
  type?: string;
  CEO?: string;
  address?: string;
  city?: string;
  zip?: string;
  state?: string;
  country?: string;
  phone?: string;
  /** Present on error responses */
  code?: number;
  status?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Fundamentals
// ---------------------------------------------------------------------------

export interface TwelveDataFundamentalsMeta {
  symbol: string;
  name?: string;
  currency?: string;
  exchange?: string;
}

export interface TwelveDataIncomeStatementPeriod {
  /** "YYYY-MM-DD" */
  fiscal_date: string;
  revenue?: string;
  cost_of_revenue?: string;
  gross_profit?: string;
  research_and_development?: string;
  selling_general_and_administrative?: string;
  operating_expenses?: string;
  operating_income?: string;
  ebit?: string;
  ebitda?: string;
  net_income?: string;
  eps_basic?: string;
  eps_diluted?: string;
}

export interface TwelveDataIncomeStatementResponse {
  meta: TwelveDataFundamentalsMeta;
  income_statement: {
    annual?: TwelveDataIncomeStatementPeriod[];
    quarterly?: TwelveDataIncomeStatementPeriod[];
  };
  code?: number;
  status?: string;
  message?: string;
}

export interface TwelveDataBalanceSheetPeriod {
  /** "YYYY-MM-DD" */
  fiscal_date: string;
  total_assets?: string;
  total_current_assets?: string;
  total_liabilities?: string;
  total_current_liabilities?: string;
  total_equity?: string;
  cash_and_cash_equivalents?: string;
  short_term_investments?: string;
  net_receivables?: string;
  inventory?: string;
  short_term_debt?: string;
  long_term_debt?: string;
  total_debt?: string;
  retained_earnings?: string;
}

export interface TwelveDataBalanceSheetResponse {
  meta: TwelveDataFundamentalsMeta;
  balance_sheet: {
    annual?: TwelveDataBalanceSheetPeriod[];
    quarterly?: TwelveDataBalanceSheetPeriod[];
  };
  code?: number;
  status?: string;
  message?: string;
}

export interface TwelveDataCashFlowPeriod {
  /** "YYYY-MM-DD" */
  fiscal_date: string;
  operating_activities?: string;
  investing_activities?: string;
  financing_activities?: string;
  net_change_in_cash?: string;
  capital_expenditure?: string;
  free_cash_flow?: string;
  depreciation_and_amortization?: string;
}

export interface TwelveDataCashFlowResponse {
  meta: TwelveDataFundamentalsMeta;
  cash_flow_statement: {
    annual?: TwelveDataCashFlowPeriod[];
    quarterly?: TwelveDataCashFlowPeriod[];
  };
  code?: number;
  status?: string;
  message?: string;
}
