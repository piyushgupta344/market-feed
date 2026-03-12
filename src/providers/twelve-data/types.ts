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
