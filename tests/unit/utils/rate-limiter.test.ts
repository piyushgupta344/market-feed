import { describe, expect, it, vi } from "vitest";
import { RateLimiter } from "../../../src/utils/rate-limiter.js";
import { RateLimitError } from "../../../src/errors.js";

describe("RateLimiter", () => {
  describe("consume()", () => {
    it("allows consuming when tokens are available", () => {
      const limiter = new RateLimiter("test", 5, 1);
      expect(() => limiter.consume()).not.toThrow();
    });

    it("throws RateLimitError when bucket is empty", () => {
      const limiter = new RateLimiter("test", 2, 0.1); // 2 capacity, very slow refill
      limiter.consume();
      limiter.consume();
      expect(() => limiter.consume()).toThrow(RateLimitError);
    });

    it("RateLimitError includes provider name", () => {
      const limiter = new RateLimiter("alpha-vantage", 1, 0.1);
      limiter.consume();
      try {
        limiter.consume();
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(RateLimitError);
        expect((err as RateLimitError).provider).toBe("alpha-vantage");
      }
    });

    it("RateLimitError includes retryAfter date in the future", () => {
      const limiter = new RateLimiter("test", 1, 1); // 1 token/sec
      limiter.consume(); // drains the 1 token
      try {
        limiter.consume();
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(RateLimitError);
        const retryAfter = (err as RateLimitError).retryAfter;
        expect(retryAfter).toBeInstanceOf(Date);
        expect(retryAfter!.getTime()).toBeGreaterThan(Date.now());
      }
    });

    it("allows consuming multiple tokens at once", () => {
      const limiter = new RateLimiter("test", 10, 1);
      expect(() => limiter.consume(5)).not.toThrow();
      expect(() => limiter.consume(5)).not.toThrow();
      expect(() => limiter.consume(1)).toThrow(RateLimitError);
    });

    it("refills tokens over time", () => {
      vi.useFakeTimers();
      const limiter = new RateLimiter("test", 5, 5); // 5 tokens/sec
      limiter.consume(5); // drain all

      // Advance 1 second — should refill 5 tokens
      vi.advanceTimersByTime(1000);
      expect(() => limiter.consume(5)).not.toThrow();
      vi.useRealTimers();
    });

    it("does not exceed capacity when refilling", () => {
      vi.useFakeTimers();
      const limiter = new RateLimiter("test", 3, 10); // capacity 3, 10/sec refill

      // Advance 5 seconds — should NOT add 50 tokens, capped at 3
      vi.advanceTimersByTime(5000);
      expect(() => limiter.consume(3)).not.toThrow();
      expect(() => limiter.consume(1)).toThrow(RateLimitError); // only 3 max
      vi.useRealTimers();
    });
  });

  describe("canConsume()", () => {
    it("returns true when tokens are available", () => {
      const limiter = new RateLimiter("test", 5, 1);
      expect(limiter.canConsume(3)).toBe(true);
    });

    it("returns false when insufficient tokens", () => {
      const limiter = new RateLimiter("test", 2, 0.01);
      limiter.consume(2);
      expect(limiter.canConsume(1)).toBe(false);
    });

    it("does not consume tokens", () => {
      const limiter = new RateLimiter("test", 1, 0.01);
      expect(limiter.canConsume()).toBe(true);
      expect(limiter.canConsume()).toBe(true); // still available — canConsume doesn't drain
      expect(() => limiter.consume()).not.toThrow();
    });
  });

  describe("waitTimeMs()", () => {
    it("returns 0 when tokens are available", () => {
      const limiter = new RateLimiter("test", 5, 1);
      expect(limiter.waitTimeMs()).toBe(0);
    });

    it("returns positive ms when bucket is empty", () => {
      const limiter = new RateLimiter("test", 1, 1); // 1 token/sec
      limiter.consume();
      const wait = limiter.waitTimeMs();
      expect(wait).toBeGreaterThan(0);
      expect(wait).toBeLessThanOrEqual(1000); // at most 1 second for 1 token at 1/sec
    });

    it("returns correct wait for fractional refill rate", () => {
      // 5 req/min = 5/60 per second
      const limiter = new RateLimiter("test", 5, 5 / 60);
      limiter.consume(5); // drain all 5
      // Need 1 more token at 5/60 per sec = 12 seconds
      const wait = limiter.waitTimeMs(1);
      expect(wait).toBeGreaterThanOrEqual(11_000);
      expect(wait).toBeLessThanOrEqual(13_000);
    });
  });
});
