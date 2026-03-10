# Rate Limiting

market-feed enforces rate limits client-side to prevent accidentally exhausting your free-tier quotas.

## Built-in limits

| Provider | Burst capacity | Refill rate |
|----------|---------------|-------------|
| Yahoo Finance | No limit | — |
| Alpha Vantage | 5 tokens | 5 / 60 per second (5/min) |
| Polygon.io | 5 tokens | 5 / 60 per second (5/min) |

## How it works — token bucket

Each provider uses a **token bucket** algorithm:

- The bucket starts full (capacity = burst limit)
- Each API call consumes one token
- Tokens refill at the configured rate over time
- When the bucket is empty, `RateLimitError` is thrown immediately (no blocking)

```ts
import { RateLimitError } from "market-feed";

try {
  await feed.quote("AAPL");
} catch (err) {
  if (err instanceof RateLimitError) {
    const waitMs = err.retryAfter
      ? err.retryAfter.getTime() - Date.now()
      : 12_000; // 12s default for 5/min

    await new Promise(resolve => setTimeout(resolve, waitMs));
    // retry...
  }
}
```

## Custom rate limiter

If you have a paid plan with higher limits, override the built-in limiter:

```ts
import { RateLimiter, AlphaVantageProvider } from "market-feed";

const provider = new AlphaVantageProvider({
  apiKey: process.env.AV_KEY!,
  // Premium plan: 75 calls/minute
  rateLimiter: new RateLimiter("alpha-vantage", 75, 75 / 60),
});
```

## RateLimiter API

The `RateLimiter` class is exported for use in custom providers:

```ts
import { RateLimiter } from "market-feed";

const limiter = new RateLimiter(
  "my-provider",   // name (used in error messages)
  10,              // capacity (max burst)
  10 / 60,         // refill rate (tokens per second)
);

// Throw if no token available
limiter.consume();

// Check without consuming
if (limiter.canConsume()) {
  limiter.consume();
}

// How long until 1 token is available (ms)
const waitMs = limiter.waitTimeMs();
```

## Alpha Vantage daily limit

Alpha Vantage free accounts are capped at **25 calls/day**. The built-in limiter only enforces the per-minute limit.

For the daily limit, track calls yourself or use caching aggressively:

```ts
const feed = new MarketFeed({
  providers: [new AlphaVantageProvider({ apiKey: "…" })],
  cache: {
    ttlOverrides: {
      quote: 3600,        // 1 hour — saves 24 out of 25 daily calls
      historical: 86400,  // 24 hours
      company: 604800,    // 1 week
    },
  },
});
```
