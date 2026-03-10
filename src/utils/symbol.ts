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
