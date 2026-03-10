import { RateLimitError } from "../errors.js";

/**
 * Token-bucket rate limiter.
 *
 * Tokens refill at `refillRate` tokens per second up to `capacity`.
 * Call `consume()` before each API request; it throws `RateLimitError`
 * if the bucket is empty.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number; // epoch ms

  /**
   * @param providerName  Used in error messages
   * @param capacity      Maximum tokens in the bucket (= burst limit)
   * @param refillRate    Tokens added per second
   */
  constructor(
    private readonly providerName: string,
    private readonly capacity: number,
    private readonly refillRate: number,
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  /**
   * Attempt to consume `count` tokens.
   * Throws `RateLimitError` if insufficient tokens are available.
   */
  consume(count = 1): void {
    this.refill();

    if (this.tokens < count) {
      // Calculate when enough tokens will be available
      const deficit = count - this.tokens;
      const waitSeconds = deficit / this.refillRate;
      const retryAfter = new Date(Date.now() + waitSeconds * 1_000);
      throw new RateLimitError(this.providerName, retryAfter);
    }

    this.tokens -= count;
  }

  /**
   * Returns true if at least `count` tokens are available without consuming them.
   */
  canConsume(count = 1): boolean {
    this.refill();
    return this.tokens >= count;
  }

  /** Milliseconds until the bucket has at least `count` tokens. 0 if already available. */
  waitTimeMs(count = 1): number {
    this.refill();
    if (this.tokens >= count) return 0;
    const deficit = count - this.tokens;
    return Math.ceil((deficit / this.refillRate) * 1_000);
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1_000; // seconds
    const newTokens = elapsed * this.refillRate;
    this.tokens = Math.min(this.capacity, this.tokens + newTokens);
    this.lastRefill = now;
  }
}
