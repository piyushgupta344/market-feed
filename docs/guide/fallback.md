# Fallback & Reliability

Providing a chain of providers makes your application resilient to temporary outages, rate limits, and unsupported operations.

## How fallback works

When `fallback: true` (the default), market-feed tries providers in the order they appear in the `providers` array:

1. Call the first provider
2. If it throws a `MarketFeedError` (including `ProviderError`, `RateLimitError`, or `UnsupportedOperationError`), try the next provider
3. If all providers fail, throw `AllProvidersFailedError` with the collected errors

```ts
const feed = new MarketFeed({
  providers: [
    new YahooProvider(),          // tried first
    new AlphaVantageProvider(…),  // fallback 1
    new PolygonProvider(…),       // fallback 2
  ],
  fallback: true,
});

// If Yahoo is down, Alpha Vantage is tried automatically.
// quote.provider tells you which one answered.
const quote = await feed.quote("AAPL");
console.log(quote.provider); // "yahoo" | "alpha-vantage" | "polygon"
```

## Disable fallback

If you want strict provider behaviour (fail fast on the first error):

```ts
const feed = new MarketFeed({
  providers: [new YahooProvider()],
  fallback: false,
});
```

## Unsupported operations

When a provider doesn't implement an optional method (e.g. Yahoo doesn't support `news()`), an `UnsupportedOperationError` is thrown for that provider and fallback kicks in automatically:

```ts
const feed = new MarketFeed({
  providers: [
    new YahooProvider(),                                     // no news()
    new PolygonProvider({ apiKey: process.env.POLYGON_KEY! }), // has news()
  ],
});

// Yahoo is skipped automatically; Polygon answers
const news = await feed.news("AAPL");
```

## Handling `AllProvidersFailedError`

```ts
import { AllProvidersFailedError, RateLimitError } from "market-feed";

try {
  const quote = await feed.quote("AAPL");
} catch (err) {
  if (err instanceof AllProvidersFailedError) {
    console.error("All providers failed:");
    for (const e of err.errors) {
      if (e instanceof RateLimitError) {
        console.error(`  ${e.provider}: rate limited, retry after ${e.retryAfter?.toISOString()}`);
      } else {
        console.error(`  ${e.provider}: ${e.message}`);
      }
    }
  }
}
```

## Provider selection strategy

The default strategy is **first-wins**: the first provider that succeeds in the chain answers the request. This is the most predictable and cache-friendly strategy.

For most use cases the recommended chain is:
1. **Yahoo Finance** — free, no key, good coverage
2. **Alpha Vantage** — free key, provides fundamental data Yahoo may miss
3. **Polygon.io** — free key, adds news support

## Caching + fallback interaction

The cache is checked before any provider is tried. If a cached response exists, no provider is called at all. This means:

- A successful Yahoo response is cached
- On the next call, the cached response is returned without calling any provider
- Providers are only tried again after the cache TTL expires

This keeps your provider call counts low and your application fast.
