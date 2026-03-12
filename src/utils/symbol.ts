/**
 * Normalise a ticker symbol for use with a specific provider.
 *
 * Different providers use slightly different conventions:
 *  - Yahoo Finance:   "BRK-B", "BTC-USD"
 *  - Alpha Vantage:  "BRKB",  "BTCUSD" (no separator for crypto pairs)
 *  - Polygon.io:     "BRK/B", "X:BTCUSD"
 */

/** Strip exchange suffixes like ".NASDAQ" or ".NYSE" */
export function stripExchange(symbol: string): string {
  return symbol.split(".")[0] ?? symbol;
}

/** Upper-case and trim a symbol */
export function normalise(symbol: string): string {
  return symbol.trim().toUpperCase();
}

/** Convert "BTC/USD" or "BTCUSD" → "BTC-USD" (Yahoo style) */
export function toYahooSymbol(symbol: string): string {
  const s = normalise(stripExchange(symbol));
  // "BTC/USD" → "BTC-USD"
  if (s.includes("/")) return s.replace("/", "-");
  return s;
}

/** Convert "BTC-USD" → "BTCUSD" (Alpha Vantage style for some endpoints) */
export function toAlphaVantageSymbol(symbol: string): string {
  return normalise(stripExchange(symbol)).replace(/[-/]/g, "");
}

/** Convert "BTC-USD" → "X:BTCUSD" for Polygon crypto, else leave as-is */
export function toPolygonSymbol(symbol: string): string {
  const s = normalise(stripExchange(symbol));
  if (s.includes("-")) {
    const [base, quote] = s.split("-");
    if (base && quote && quote.length === 3) {
      // Likely a crypto pair
      return `X:${base}${quote}`;
    }
  }
  return s;
}

/** Deduplicate and normalise an array of symbols */
export function dedupeSymbols(symbols: string[]): string[] {
  return [...new Set(symbols.map(normalise))];
}

// ---------------------------------------------------------------------------
// Asset-class detection
// ---------------------------------------------------------------------------

/**
 * Well-known crypto base currencies.
 * Used to distinguish BTC/USD (crypto) from EUR/USD (forex) in slash-separated pairs.
 */
const KNOWN_CRYPTO_BASES = new Set([
  "BTC", "ETH", "ADA", "SOL", "XRP", "DOGE", "DOT", "AVAX", "MATIC", "LINK",
  "LTC", "BCH", "UNI", "ATOM", "BNB", "TRX", "SHIB", "NEAR", "APT", "ARB",
]);

/** Quote currencies that, combined with a known crypto base, confirm a crypto pair */
const CRYPTO_QUOTE_CURRENCIES = new Set([
  "USD", "EUR", "BTC", "ETH", "USDT", "USDC", "GBP", "BUSD",
]);

/**
 * Returns `true` if the symbol looks like a cryptocurrency pair.
 *
 * Handles:
 * - Yahoo-style:   "BTC-USD", "ETH-USD"
 * - Slash-style:   "BTC/USD", "ETH/BTC"
 * - Polygon-style: "X:BTCUSD"
 */
export function isCrypto(symbol: string): boolean {
  const s = normalise(symbol);
  if (s.startsWith("X:")) return true; // Polygon crypto prefix
  if (s.includes("/")) {
    const [base, quote] = s.split("/");
    return (
      KNOWN_CRYPTO_BASES.has(base ?? "") && CRYPTO_QUOTE_CURRENCIES.has(quote ?? "")
    );
  }
  if (s.includes("-") && !s.endsWith("=X")) {
    const [base, quote] = s.split("-");
    return (
      (KNOWN_CRYPTO_BASES.has(base ?? "") || (quote?.length === 3 && KNOWN_CRYPTO_BASES.has(base ?? ""))) &&
      CRYPTO_QUOTE_CURRENCIES.has(quote ?? "")
    );
  }
  return false;
}

/**
 * Returns `true` if the symbol looks like a forex pair.
 *
 * Handles:
 * - Yahoo-style:   "EURUSD=X", "GBPUSD=X"
 * - Polygon-style: "C:EURUSD"
 * - OANDA-style:   "OANDA:EUR_USD"
 * - Standard:      "EUR/USD", "GBP/JPY" (when not also a crypto pair)
 */
export function isForex(symbol: string): boolean {
  const s = normalise(symbol);
  if (s.startsWith("C:")) return true;      // Polygon forex prefix
  if (s.startsWith("OANDA:")) return true;  // OANDA format
  if (/^[A-Z]{6}=X$/.test(s)) return true; // Yahoo forex (e.g. "EURUSD=X")
  // Standard three-letter pair — only if not already classified as crypto
  if (/^[A-Z]{3}\/[A-Z]{3}$/.test(s) && !isCrypto(s)) return true;
  return false;
}

/**
 * Convert a symbol to Finnhub format.
 * Finnhub uses plain uppercase tickers for US stocks (e.g. "AAPL").
 */
export function toFinnhubSymbol(symbol: string): string {
  return normalise(stripExchange(symbol));
}

/**
 * Convert a symbol to Twelve Data format.
 * Twelve Data uses slash notation for crypto/forex pairs (e.g. "BTC/USD", "EUR/USD").
 * US stocks remain unchanged (e.g. "AAPL").
 */
export function toTwelveDataSymbol(symbol: string): string {
  const s = normalise(stripExchange(symbol));
  // Polygon crypto: "X:BTCUSD" → "BTC/USD"
  if (s.startsWith("X:") && s.length >= 5) {
    const pair = s.slice(2);
    return `${pair.slice(0, 3)}/${pair.slice(3)}`;
  }
  // Polygon forex: "C:EURUSD" → "EUR/USD"
  if (s.startsWith("C:") && s.length >= 5) {
    const pair = s.slice(2);
    return `${pair.slice(0, 3)}/${pair.slice(3)}`;
  }
  // Yahoo forex: "EURUSD=X" → "EUR/USD"
  if (/^[A-Z]{6}=X$/.test(s)) {
    return `${s.slice(0, 3)}/${s.slice(3, 6)}`;
  }
  // Yahoo/common dash notation: "BTC-USD" → "BTC/USD"
  if (s.includes("-") && !s.endsWith("=X")) {
    return s.replace("-", "/");
  }
  return s;
}
