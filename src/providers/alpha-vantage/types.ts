/**
 * Raw response shapes from the Alpha Vantage API.
 */

// ---------------------------------------------------------------------------
// Global Quote
// ---------------------------------------------------------------------------
export interface AVGlobalQuoteResponse {
  "Global Quote"?: AVGlobalQuote;
  Information?: string; // rate-limit message
  Note?: string; // rate-limit note
}

export interface AVGlobalQuote {
  "01. symbol": string;
  "02. open": string;
  "03. high": string;
  "04. low": string;
  "05. price": string;
  "06. volume": string;
  "07. latest trading day": string;
  "08. previous close": string;
  "09. change": string;
  "10. change percent": string;
}

// ---------------------------------------------------------------------------
// Time Series Daily (Adjusted)
// ---------------------------------------------------------------------------
export interface AVTimeSeriesDailyResponse {
  "Meta Data"?: AVTimeSeriesMeta;
  "Time Series (Daily)"?: Record<string, AVDailyBar>;
  "Time Series (Daily Adjusted)"?: Record<string, AVDailyAdjBar>;
  Information?: string;
  Note?: string;
}

export interface AVTimeSeriesMeta {
  "1. Information": string;
  "2. Symbol": string;
  "3. Last Refreshed": string;
  "4. Output Size": string;
  "5. Time Zone": string;
}

export interface AVDailyBar {
  "1. open": string;
  "2. high": string;
  "3. low": string;
  "4. close": string;
  "5. volume": string;
}

export interface AVDailyAdjBar extends AVDailyBar {
  "5. adjusted close": string;
  "6. volume": string;
  "7. dividend amount": string;
  "8. split coefficient": string;
}

// ---------------------------------------------------------------------------
// Symbol Search
// ---------------------------------------------------------------------------
export interface AVSearchResponse {
  bestMatches?: AVSearchMatch[];
  Information?: string;
  Note?: string;
}

export interface AVSearchMatch {
  "1. symbol": string;
  "2. name": string;
  "3. type": string;
  "4. region": string;
  "5. marketOpen": string;
  "6. marketClose": string;
  "7. timezone": string;
  "8. currency": string;
  "9. matchScore": string;
}

// ---------------------------------------------------------------------------
// Company Overview
// ---------------------------------------------------------------------------
export interface AVOverviewResponse {
  Symbol?: string;
  Name?: string;
  Description?: string;
  Exchange?: string;
  Currency?: string;
  Country?: string;
  Sector?: string;
  Industry?: string;
  FullTimeEmployees?: string;
  OfficialSite?: string;
  MarketCapitalization?: string;
  TrailingPE?: string;
  ForwardPE?: string;
  PriceToBookRatio?: string;
  DividendYield?: string;
  Beta?: string;
  IPODate?: string;
  Information?: string;
  Note?: string;
}
