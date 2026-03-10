/**
 * Base error class for all market-feed errors.
 * Includes the provider name so callers can identify the source.
 */
export class MarketFeedError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "MarketFeedError";
    // Maintain correct prototype chain in transpiled output
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an upstream provider returns an HTTP error or unexpected payload.
 */
export class ProviderError extends MarketFeedError {
  constructor(
    message: string,
    provider: string,
    public readonly statusCode?: number,
    cause?: unknown,
  ) {
    super(message, provider, cause);
    this.name = "ProviderError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a provider's rate limit is reached.
 * Contains the earliest time the caller may retry.
 */
export class RateLimitError extends MarketFeedError {
  constructor(
    provider: string,
    public readonly retryAfter?: Date,
  ) {
    const when = retryAfter ? ` Retry after ${retryAfter.toISOString()}.` : "";
    super(`Rate limit reached for provider "${provider}".${when}`, provider);
    this.name = "RateLimitError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when all configured providers have failed for a given operation.
 */
export class AllProvidersFailedError extends Error {
  constructor(
    public readonly errors: MarketFeedError[],
    operation: string,
  ) {
    const summary = errors.map((e) => `[${e.provider}] ${e.message}`).join("; ");
    super(`All providers failed for "${operation}": ${summary}`);
    this.name = "AllProvidersFailedError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a required feature is not supported by the active provider.
 */
export class UnsupportedOperationError extends MarketFeedError {
  constructor(provider: string, operation: string) {
    super(`Provider "${provider}" does not support "${operation}".`, provider);
    this.name = "UnsupportedOperationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
