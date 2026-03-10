import { describe, expect, it } from "vitest";
import {
  dedupeSymbols,
  normalise,
  stripExchange,
  toAlphaVantageSymbol,
  toPolygonSymbol,
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
