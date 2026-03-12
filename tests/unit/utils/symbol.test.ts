import { describe, expect, it } from "vitest";
import {
  dedupeSymbols,
  isCrypto,
  isForex,
  normalise,
  stripExchange,
  toAlphaVantageSymbol,
  toFinnhubSymbol,
  toPolygonSymbol,
  toTwelveDataSymbol,
  toYahooSymbol,
} from "../../../src/utils/symbol.js";

describe("normalise()", () => {
  it("uppercases a symbol", () => {
    expect(normalise("aapl")).toBe("AAPL");
  });

  it("trims whitespace", () => {
    expect(normalise("  MSFT  ")).toBe("MSFT");
  });

  it("handles mixed case with whitespace", () => {
    expect(normalise("  gOoGl  ")).toBe("GOOGL");
  });
});

describe("stripExchange()", () => {
  it("removes exchange suffix", () => {
    expect(stripExchange("AAPL.NASDAQ")).toBe("AAPL");
  });

  it("handles multiple dots by keeping only first segment", () => {
    expect(stripExchange("BRK.B.NYSE")).toBe("BRK");
  });

  it("returns symbol unchanged when no suffix present", () => {
    expect(stripExchange("AAPL")).toBe("AAPL");
  });
});

describe("toYahooSymbol()", () => {
  it("returns plain stock symbols unchanged", () => {
    expect(toYahooSymbol("AAPL")).toBe("AAPL");
  });

  it("converts slash-separated forex/crypto to dash", () => {
    expect(toYahooSymbol("BTC/USD")).toBe("BTC-USD");
  });

  it("strips exchange suffix", () => {
    expect(toYahooSymbol("AAPL.NASDAQ")).toBe("AAPL");
  });

  it("uppercases the result", () => {
    expect(toYahooSymbol("aapl")).toBe("AAPL");
  });

  it("preserves existing dash-separated pairs", () => {
    expect(toYahooSymbol("BTC-USD")).toBe("BTC-USD");
  });
});

describe("toAlphaVantageSymbol()", () => {
  it("removes dash separator", () => {
    expect(toAlphaVantageSymbol("BTC-USD")).toBe("BTCUSD");
  });

  it("removes slash separator", () => {
    expect(toAlphaVantageSymbol("EUR/USD")).toBe("EURUSD");
  });

  it("returns plain stock symbols unchanged", () => {
    expect(toAlphaVantageSymbol("AAPL")).toBe("AAPL");
  });

  it("strips exchange suffix", () => {
    expect(toAlphaVantageSymbol("AAPL.NASDAQ")).toBe("AAPL");
  });

  it("uppercases the result", () => {
    expect(toAlphaVantageSymbol("btc-usd")).toBe("BTCUSD");
  });
});

describe("toPolygonSymbol()", () => {
  it("returns stock symbols unchanged", () => {
    expect(toPolygonSymbol("AAPL")).toBe("AAPL");
  });

  it("converts BTC-USD to X:BTCUSD format for crypto", () => {
    expect(toPolygonSymbol("BTC-USD")).toBe("X:BTCUSD");
  });

  it("converts ETH-USD to X:ETHUSD", () => {
    expect(toPolygonSymbol("ETH-USD")).toBe("X:ETHUSD");
  });

  it("strips exchange suffix", () => {
    expect(toPolygonSymbol("AAPL.NASDAQ")).toBe("AAPL");
  });

  it("uppercases the result", () => {
    expect(toPolygonSymbol("aapl")).toBe("AAPL");
  });

  it("does not convert non-crypto dashes (long quote currency)", () => {
    // e.g. "BRK-B" — quote part is 1 char, not a currency
    expect(toPolygonSymbol("BRK-B")).toBe("BRK-B");
  });
});

describe("dedupeSymbols()", () => {
  it("removes exact duplicates", () => {
    const result = dedupeSymbols(["AAPL", "AAPL", "MSFT"]);
    expect(result).toHaveLength(2);
    expect(result).toContain("AAPL");
    expect(result).toContain("MSFT");
  });

  it("deduplicates case-insensitively (normalises to uppercase)", () => {
    const result = dedupeSymbols(["aapl", "AAPL", "msft"]);
    expect(result).toHaveLength(2);
    expect(result).toContain("AAPL");
    expect(result).toContain("MSFT");
  });

  it("returns empty array for empty input", () => {
    expect(dedupeSymbols([])).toEqual([]);
  });

  it("returns single-element array unchanged", () => {
    expect(dedupeSymbols(["GOOGL"])).toEqual(["GOOGL"]);
  });
});

describe("isCrypto()", () => {
  it("recognises Yahoo-style crypto pair (BTC-USD)", () => {
    expect(isCrypto("BTC-USD")).toBe(true);
    expect(isCrypto("ETH-USD")).toBe(true);
    expect(isCrypto("BTC-EUR")).toBe(true);
  });

  it("recognises slash-style crypto pair (BTC/USD)", () => {
    expect(isCrypto("BTC/USD")).toBe(true);
    expect(isCrypto("ETH/BTC")).toBe(true);
  });

  it("recognises Polygon-style X: prefix", () => {
    expect(isCrypto("X:BTCUSD")).toBe(true);
  });

  it("returns false for plain stock tickers", () => {
    expect(isCrypto("AAPL")).toBe(false);
    expect(isCrypto("MSFT")).toBe(false);
    expect(isCrypto("BRK-B")).toBe(false);
  });

  it("returns false for Yahoo forex tickers (EURUSD=X)", () => {
    expect(isCrypto("EURUSD=X")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isCrypto("btc-usd")).toBe(true);
    expect(isCrypto("eth/btc")).toBe(true);
  });
});

describe("isForex()", () => {
  it("recognises Yahoo-style forex (EURUSD=X)", () => {
    expect(isForex("EURUSD=X")).toBe(true);
    expect(isForex("GBPUSD=X")).toBe(true);
  });

  it("recognises Polygon-style forex (C:EURUSD)", () => {
    expect(isForex("C:EURUSD")).toBe(true);
  });

  it("recognises OANDA-style forex (OANDA:EUR_USD)", () => {
    expect(isForex("OANDA:EUR_USD")).toBe(true);
  });

  it("recognises standard three-letter pair (EUR/USD)", () => {
    expect(isForex("EUR/USD")).toBe(true);
    expect(isForex("GBP/JPY")).toBe(true);
  });

  it("returns false for plain stocks", () => {
    expect(isForex("AAPL")).toBe(false);
    expect(isForex("MSFT")).toBe(false);
  });

  it("returns false for crypto pairs", () => {
    expect(isForex("BTC-USD")).toBe(false);
    expect(isForex("X:BTCUSD")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isForex("eurusd=x")).toBe(true);
  });
});

describe("toFinnhubSymbol()", () => {
  it("returns normalised uppercase ticker", () => {
    expect(toFinnhubSymbol("aapl")).toBe("AAPL");
    expect(toFinnhubSymbol("  msft  ")).toBe("MSFT");
  });

  it("strips exchange suffix", () => {
    expect(toFinnhubSymbol("AAPL.NASDAQ")).toBe("AAPL");
  });
});

describe("toTwelveDataSymbol()", () => {
  it("returns plain ticker for US stocks", () => {
    expect(toTwelveDataSymbol("AAPL")).toBe("AAPL");
    expect(toTwelveDataSymbol("aapl")).toBe("AAPL");
    expect(toTwelveDataSymbol("  MSFT  ")).toBe("MSFT");
  });

  it("converts Yahoo dash crypto to slash notation", () => {
    expect(toTwelveDataSymbol("BTC-USD")).toBe("BTC/USD");
    expect(toTwelveDataSymbol("ETH-USD")).toBe("ETH/USD");
  });

  it("converts Yahoo forex to slash notation", () => {
    expect(toTwelveDataSymbol("EURUSD=X")).toBe("EUR/USD");
    expect(toTwelveDataSymbol("GBPUSD=X")).toBe("GBP/USD");
  });

  it("converts Polygon crypto prefix to slash notation", () => {
    expect(toTwelveDataSymbol("X:BTCUSD")).toBe("BTC/USD");
    expect(toTwelveDataSymbol("X:ETHUSD")).toBe("ETH/USD");
  });

  it("converts Polygon forex prefix to slash notation", () => {
    expect(toTwelveDataSymbol("C:EURUSD")).toBe("EUR/USD");
  });

  it("strips exchange suffix before converting", () => {
    expect(toTwelveDataSymbol("AAPL.NASDAQ")).toBe("AAPL");
  });
});
