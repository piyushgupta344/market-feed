import { describe, expect, it, vi } from "vitest";
import {
  applyStalenessPenalty,
  computeConfidence,
  detectOutliers,
  normalizeWeights,
  weightedMean,
} from "../../../src/consensus/algorithm.js";
import { consensus } from "../../../src/consensus/index.js";
import { AllProvidersFailedError } from "../../../src/errors.js";
import type { MarketProvider } from "../../../src/types/provider.js";
import type { Quote } from "../../../src/types/quote.js";

// ---------------------------------------------------------------------------
// Helper: create a minimal mock provider
// ---------------------------------------------------------------------------
function mockProvider(name: string, price: number, ageMs = 0): MarketProvider {
  const timestamp = new Date(Date.now() - ageMs);
  const quote: Quote = {
    symbol: "AAPL",
    name: "Apple Inc.",
    price,
    change: 0,
    changePercent: 0,
    open: price,
    high: price,
    low: price,
    close: price,
    previousClose: price,
    volume: 1_000_000,
    currency: "USD",
    exchange: "XNAS",
    timestamp,
    provider: name,
  };
  return {
    name,
    quote: vi.fn().mockResolvedValue([quote]),
    historical: vi.fn().mockResolvedValue([]),
    search: vi.fn().mockResolvedValue([]),
  };
}

function failingProvider(name: string): MarketProvider {
  return {
    name,
    quote: vi.fn().mockRejectedValue(new Error(`${name} unavailable`)),
    historical: vi.fn().mockResolvedValue([]),
    search: vi.fn().mockResolvedValue([]),
  };
}

// ---------------------------------------------------------------------------
// Algorithm unit tests
// ---------------------------------------------------------------------------

describe("normalizeWeights", () => {
  it("produces equal weights by default", () => {
    const w = normalizeWeights(["a", "b", "c"]);
    expect(w["a"]).toBeCloseTo(1 / 3, 5);
    expect(w["b"]).toBeCloseTo(1 / 3, 5);
    expect(w["c"]).toBeCloseTo(1 / 3, 5);
  });

  it("respects custom weights", () => {
    const w = normalizeWeights(["yahoo", "polygon"], { yahoo: 2, polygon: 1 });
    expect(w["yahoo"]).toBeCloseTo(2 / 3, 5);
    expect(w["polygon"]).toBeCloseTo(1 / 3, 5);
  });

  it("returns empty object for empty provider list", () => {
    expect(normalizeWeights([])).toEqual({});
  });
});

describe("applyStalenessPenalty", () => {
  it("halves stale provider weight and renormalizes", () => {
    const w = { yahoo: 0.5, polygon: 0.5 };
    const stale = new Set(["polygon"]);
    const result = applyStalenessPenalty(w, stale);
    // yahoo: 0.5, polygon: 0.25 → total 0.75 → yahoo: 0.5/0.75 ≈ 0.667, polygon ≈ 0.333
    expect(result["yahoo"]).toBeCloseTo(2 / 3, 5);
    expect(result["polygon"]).toBeCloseTo(1 / 3, 5);
  });

  it("returns original weights when no stale providers", () => {
    const w = { yahoo: 0.5, polygon: 0.5 };
    expect(applyStalenessPenalty(w, new Set())).toEqual(w);
  });
});

describe("weightedMean", () => {
  it("computes simple average for equal weights", () => {
    const prices = { a: 100, b: 200 };
    const weights = { a: 0.5, b: 0.5 };
    expect(weightedMean(prices, weights)).toBe(150);
  });

  it("respects unequal weights", () => {
    const prices = { a: 100, b: 200 };
    const weights = { a: 0.75, b: 0.25 };
    expect(weightedMean(prices, weights)).toBeCloseTo(125, 5);
  });
});

describe("detectOutliers", () => {
  it("detects a price far from the mean", () => {
    const prices = { yahoo: 190, polygon: 191, av: 210 };
    const mean = 190.5; // approx
    const outliers = detectOutliers(prices, mean, 2.0);
    expect(outliers.has("av")).toBe(true);
    expect(outliers.has("yahoo")).toBe(false);
  });

  it("returns empty set when all prices are within threshold", () => {
    const prices = { yahoo: 190, polygon: 190.5 };
    const outliers = detectOutliers(prices, 190.25, 2.0);
    expect(outliers.size).toBe(0);
  });
});

describe("computeConfidence", () => {
  it("returns 1 for perfect agreement, no stale, multiple sources (clamped)", () => {
    // 1 - 0 - 0 - 0 + 0.05 = 1.05 → clamp to 1
    const c = computeConfidence(0, 0, 3, false);
    expect(c).toBe(1);
  });

  it("penalizes single source", () => {
    const c = computeConfidence(0, 0, 1, true);
    // 1 - 0 - 0 - 0.2 + 0 = 0.8
    expect(c).toBeCloseTo(0.8, 5);
  });

  it("penalizes stale data", () => {
    const c = computeConfidence(0, 2, 2, false);
    // 1 - 0 - 0.2 - 0 + 0.025 = 0.825
    expect(c).toBeCloseTo(0.825, 5);
  });

  it("clamps to 0 for extreme divergence", () => {
    const c = computeConfidence(200, 3, 2, true);
    expect(c).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Integration: consensus() function
// ---------------------------------------------------------------------------

describe("consensus()", () => {
  it("returns SINGLE_SOURCE flag and lower confidence for one provider", async () => {
    const providers = [mockProvider("yahoo", 189.84)];
    const result = await consensus(providers, "AAPL");

    expect(result.symbol).toBe("AAPL");
    expect(result.price).toBeCloseTo(189.84, 2);
    expect(result.flags).toContain("SINGLE_SOURCE");
    expect(result.confidence).toBeLessThan(1);
    expect(result.providers["yahoo"]?.price).toBe(189.84);
    expect(result.providers["yahoo"]?.included).toBe(true);
  });

  it("returns high confidence when two providers agree", async () => {
    const providers = [mockProvider("yahoo", 189.84), mockProvider("polygon", 189.86)];
    const result = await consensus(providers, "AAPL");

    expect(result.flags).not.toContain("HIGH_DIVERGENCE");
    expect(result.flags).not.toContain("SINGLE_SOURCE");
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.price).toBeCloseTo(189.85, 1);
  });

  it("flags HIGH_DIVERGENCE when providers disagree >2%", async () => {
    const providers = [
      mockProvider("yahoo", 189.84),
      mockProvider("polygon", 195.0), // > 2% away
    ];
    const result = await consensus(providers, "AAPL");

    expect(result.flags).toContain("HIGH_DIVERGENCE");
    expect(result.spreadPct).toBeGreaterThan(2);
  });

  it("flags STALE_DATA for quotes older than threshold", async () => {
    const providers = [
      mockProvider("yahoo", 189.84, 0), // fresh
      mockProvider("polygon", 189.8, 120_000), // 2 min old → stale
    ];
    const result = await consensus(providers, "AAPL", { stalenessThreshold: 60 });

    expect(result.flags).toContain("STALE_DATA");
    expect(result.providers["polygon"]?.stale).toBe(true);
    expect(result.providers["yahoo"]?.stale).toBe(false);
    // Stale provider gets lower weight → fresh provider has more influence
    expect(result.providers["yahoo"]?.weight).toBeGreaterThan(
      result.providers["polygon"]?.weight ?? 0,
    );
  });

  it("flags OUTLIER_EXCLUDED when one provider is way off", async () => {
    const providers = [
      mockProvider("yahoo", 189.84),
      mockProvider("polygon", 189.8),
      mockProvider("av", 210.0), // >2% outlier
    ];
    const result = await consensus(providers, "AAPL");

    expect(result.flags).toContain("OUTLIER_EXCLUDED");
    expect(result.providers["av"]?.included).toBe(false);
    expect(result.providers["yahoo"]?.included).toBe(true);
    // Final price should be based only on yahoo + polygon
    expect(result.price).toBeLessThan(192);
  });

  it("spread is calculated across ALL providers even when outlier excluded", async () => {
    const providers = [
      mockProvider("yahoo", 189.84),
      mockProvider("polygon", 189.8),
      mockProvider("av", 210.0),
    ];
    const result = await consensus(providers, "AAPL");
    // spread = 210 - 189.80 = 20.20
    expect(result.spread).toBeCloseTo(20.2, 1);
  });

  it("respects custom weights", async () => {
    // Use prices within 2% of each other so neither is flagged as outlier
    const providers = [
      mockProvider("yahoo", 190.0),
      mockProvider("polygon", 188.0), // 1.06% from median → not outlier
    ];
    const result = await consensus(providers, "AAPL", {
      weights: { yahoo: 3, polygon: 1 },
    });
    // Weighted mean: (190 * 0.75) + (188 * 0.25) = 142.5 + 47 = 189.5
    expect(result.price).toBeCloseTo(189.5, 1);
  });

  it("throws AllProvidersFailedError when all providers fail", async () => {
    const providers = [failingProvider("yahoo"), failingProvider("polygon")];
    await expect(consensus(providers, "AAPL")).rejects.toThrow(AllProvidersFailedError);
  });

  it("returns result when only one of two providers fails", async () => {
    const providers = [mockProvider("yahoo", 189.84), failingProvider("polygon")];
    const result = await consensus(providers, "AAPL");
    expect(result.price).toBeCloseTo(189.84, 2);
    expect(result.flags).toContain("SINGLE_SOURCE");
    expect(result.providers["yahoo"]).toBeDefined();
    expect(result.providers["polygon"]).toBeUndefined();
  });

  it("timestamp is a recent Date", async () => {
    const providers = [mockProvider("yahoo", 189.84)];
    const before = Date.now();
    const result = await consensus(providers, "AAPL");
    expect(result.timestamp).toBeInstanceOf(Date);
    expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("throws when called with empty providers array", async () => {
    await expect(consensus([], "AAPL")).rejects.toThrow(AllProvidersFailedError);
  });
});
