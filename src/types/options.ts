export interface OptionContract {
  /** OCC option ticker, e.g. "O:AAPL240119C00150000" */
  ticker: string;
  /** Underlying equity symbol, e.g. "AAPL" */
  underlyingSymbol: string;
  /** call or put */
  type: "call" | "put";
  /** Strike price */
  strike: number;
  /** Expiration date */
  expiry: Date;
  /** Exercise style */
  style: "american" | "european";
  /** Shares per contract (typically 100) */
  sharesPerContract: number;

  // Market data
  bid?: number;
  ask?: number;
  /** Mid-point of bid/ask */
  midpoint?: number;
  lastPrice?: number;
  volume?: number;
  openInterest?: number;
  impliedVolatility?: number;

  // Greeks
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;

  // Day OHLCV
  open?: number;
  high?: number;
  low?: number;
  close?: number;

  provider: string;
  raw?: unknown;
}

export interface OptionChain {
  underlyingSymbol: string;
  calls: OptionContract[];
  puts: OptionContract[];
  /** Time the chain was fetched */
  fetchedAt: Date;
}

export interface OptionChainOptions {
  /** Filter to a specific expiry date, e.g. "2024-07-19" */
  expiry?: string;
  /** Exact strike price filter */
  strike?: number;
  /** Minimum strike price */
  strikeLow?: number;
  /** Maximum strike price */
  strikeHigh?: number;
  /** Return only calls or only puts. Default: both */
  type?: "call" | "put";
  /** Max contracts to return per type. Default: 50 */
  limit?: number;
  /** Include raw provider response */
  raw?: boolean;
}
