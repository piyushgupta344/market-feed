import { describe, expect, it } from "vitest";
import {
  AllProvidersFailedError,
  MarketFeedError,
  ProviderError,
  RateLimitError,
  UnsupportedOperationError,
} from "../../src/errors.js";

describe("MarketFeedError", () => {
  it("sets name to MarketFeedError", () => {
    const err = new MarketFeedError("something went wrong", "yahoo");
    expect(err.name).toBe("MarketFeedError");
  });

  it("sets message correctly", () => {
    const err = new MarketFeedError("test message", "yahoo");
    expect(err.message).toBe("test message");
  });

  it("stores provider name", () => {
    const err = new MarketFeedError("test", "polygon");
    expect(err.provider).toBe("polygon");
  });

  it("stores optional cause", () => {
    const inner = new Error("inner");
    const err = new MarketFeedError("outer", "yahoo", inner);
    expect(err.cause).toBe(inner);
  });

  it("is instanceof Error", () => {
    const err = new MarketFeedError("test", "yahoo");
    expect(err).toBeInstanceOf(Error);
  });

  it("is instanceof MarketFeedError", () => {
    const err = new MarketFeedError("test", "yahoo");
    expect(err).toBeInstanceOf(MarketFeedError);
  });
});

describe("ProviderError", () => {
  it("sets name to ProviderError", () => {
    const err = new ProviderError("HTTP 404", "yahoo", 404);
    expect(err.name).toBe("ProviderError");
  });

  it("stores HTTP status code", () => {
    const err = new ProviderError("HTTP 429", "polygon", 429);
    expect(err.statusCode).toBe(429);
  });

  it("works without statusCode", () => {
    const err = new ProviderError("Network error", "yahoo");
    expect(err.statusCode).toBeUndefined();
  });

  it("is instanceof MarketFeedError", () => {
    const err = new ProviderError("test", "yahoo");
    expect(err).toBeInstanceOf(MarketFeedError);
  });

  it("is instanceof ProviderError", () => {
    const err = new ProviderError("test", "yahoo");
    expect(err).toBeInstanceOf(ProviderError);
  });

  it("stores cause", () => {
    const inner = new TypeError("fetch failed");
    const err = new ProviderError("Network error", "yahoo", undefined, inner);
    expect(err.cause).toBe(inner);
  });
});

describe("RateLimitError", () => {
  it("sets name to RateLimitError", () => {
    const err = new RateLimitError("alpha-vantage");
    expect(err.name).toBe("RateLimitError");
  });

  it("includes provider name in message", () => {
    const err = new RateLimitError("alpha-vantage");
    expect(err.message).toContain("alpha-vantage");
  });

  it("includes retryAfter in message when provided", () => {
    const retryAfter = new Date("2024-03-06T22:00:00Z");
    const err = new RateLimitError("alpha-vantage", retryAfter);
    expect(err.message).toContain("2024-03-06");
  });

  it("stores retryAfter date", () => {
    const retryAfter = new Date("2024-03-06T22:00:00Z");
    const err = new RateLimitError("polygon", retryAfter);
    expect(err.retryAfter).toEqual(retryAfter);
  });

  it("retryAfter is undefined when not provided", () => {
    const err = new RateLimitError("yahoo");
    expect(err.retryAfter).toBeUndefined();
  });

  it("is instanceof MarketFeedError", () => {
    const err = new RateLimitError("yahoo");
    expect(err).toBeInstanceOf(MarketFeedError);
  });
});

describe("AllProvidersFailedError", () => {
  it("sets name to AllProvidersFailedError", () => {
    const _err = new AllProvidersFailedError([], "quote");
  });

  it("includes operation name in message", () => {
    const errors = [
      new ProviderError("timeout", "yahoo"),
      new ProviderError("rate limited", "polygon"),
    ];
    const err = new AllProvidersFailedError(errors, "quote");
    expect(err.message).toContain("quote");
  });

  it("includes all provider error summaries in message", () => {
    const errors = [
      new ProviderError("timeout", "yahoo"),
      new ProviderError("rate limited", "polygon"),
    ];
    const err = new AllProvidersFailedError(errors, "quote");
    expect(err.message).toContain("yahoo");
    expect(err.message).toContain("polygon");
    expect(err.message).toContain("timeout");
    expect(err.message).toContain("rate limited");
  });

  it("stores the individual errors array", () => {
    const errors = [new ProviderError("down", "yahoo")];
    const err = new AllProvidersFailedError(errors, "historical");
    expect(err.errors).toHaveLength(1);
    expect(err.errors[0]).toBeInstanceOf(ProviderError);
  });

  it("is instanceof Error", () => {
    const err = new AllProvidersFailedError([], "search");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("UnsupportedOperationError", () => {
  it("sets name to UnsupportedOperationError", () => {
    const err = new UnsupportedOperationError("yahoo", "news");
    expect(err.name).toBe("UnsupportedOperationError");
  });

  it("includes provider and operation in message", () => {
    const err = new UnsupportedOperationError("alpha-vantage", "marketStatus");
    expect(err.message).toContain("alpha-vantage");
    expect(err.message).toContain("marketStatus");
  });

  it("is instanceof MarketFeedError", () => {
    const err = new UnsupportedOperationError("yahoo", "news");
    expect(err).toBeInstanceOf(MarketFeedError);
  });
});
