# Error Handling

market-feed uses a typed error hierarchy so you can handle failures precisely.

## Error hierarchy

```
Error
└── MarketFeedError          (base — all market-feed errors)
    ├── ProviderError        (HTTP or payload error from a provider)
    ├── RateLimitError       (free-tier rate limit reached)
    └── UnsupportedOperationError (provider doesn't support this method)

AllProvidersFailedError      (extends Error, not MarketFeedError)
```

## MarketFeedError

All market-feed errors extend `MarketFeedError`.

```ts
import { MarketFeedError } from "market-feed";

try {
  await feed.quote("AAPL");
} catch (err) {
  if (err instanceof MarketFeedError) {
    console.error(`Error from provider "${err.provider}": ${err.message}`);
    // err.cause — the underlying error if one exists
  }
}
```

**Properties:**
- `provider: string` — which provider threw
- `cause?: unknown` — underlying error (network failure, parse error, etc.)

## ProviderError

Thrown when a provider returns an unexpected HTTP status code or malformed response.

```ts
import { ProviderError } from "market-feed";

try {
  await feed.quote("AAPL");
} catch (err) {
  if (err instanceof ProviderError) {
    console.error(`HTTP ${err.statusCode ?? "?"} from ${err.provider}`);
  }
}
```

**Properties:**
- `statusCode?: number` — HTTP status code (404, 500, etc.) if applicable

## RateLimitError

Thrown when the built-in rate limiter detects you've exhausted your quota, or when a provider responds with a rate-limit message.

```ts
import { RateLimitError } from "market-feed";

try {
  await feed.quote("AAPL");
} catch (err) {
  if (err instanceof RateLimitError) {
    const wait = err.retryAfter
      ? Math.ceil((err.retryAfter.getTime() - Date.now()) / 1000)
      : "unknown";
    console.warn(`Rate limited by ${err.provider}. Retry in ${wait}s`);
  }
}
```

**Properties:**
- `retryAfter?: Date` — earliest safe time to retry

## AllProvidersFailedError

Thrown when every provider in the chain fails for the same operation.

```ts
import { AllProvidersFailedError } from "market-feed";

try {
  await feed.quote("AAPL");
} catch (err) {
  if (err instanceof AllProvidersFailedError) {
    console.error("All providers failed:");
    for (const e of err.errors) {
      console.error(`  [${e.provider}] ${e.message}`);
    }
  }
}
```

**Properties:**
- `errors: MarketFeedError[]` — individual error from each provider

## UnsupportedOperationError

Thrown when a provider doesn't implement an optional method (`company`, `news`, `marketStatus`).

With `fallback: true`, this is caught internally and the next provider is tried. You'll only see this if all providers lack the feature.

```ts
import { UnsupportedOperationError } from "market-feed";

try {
  await feed.news("AAPL");
} catch (err) {
  if (err instanceof AllProvidersFailedError) {
    const unsupported = err.errors.filter(e => e instanceof UnsupportedOperationError);
    console.warn(`${unsupported.length} provider(s) don't support news`);
  }
}
```

## Comprehensive error handler

```ts
import {
  AllProvidersFailedError,
  MarketFeedError,
  ProviderError,
  RateLimitError,
} from "market-feed";

async function safeQuote(feed: MarketFeed, symbol: string) {
  try {
    return await feed.quote(symbol);
  } catch (err) {
    if (err instanceof RateLimitError) {
      // Respect retryAfter before trying again
      if (err.retryAfter) {
        await sleep(err.retryAfter.getTime() - Date.now());
        return feed.quote(symbol);
      }
    }

    if (err instanceof AllProvidersFailedError) {
      // All providers failed — surface the most useful error
      throw err.errors.at(-1) ?? err;
    }

    if (err instanceof ProviderError && err.statusCode === 404) {
      return null; // Symbol not found
    }

    throw err; // Re-throw anything unexpected
  }
}
```
