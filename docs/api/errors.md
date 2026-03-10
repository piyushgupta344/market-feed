# Errors API

## MarketFeedError

Base class for all market-feed errors.

```ts
class MarketFeedError extends Error {
  readonly provider: string;   // which provider threw
  readonly cause?: unknown;    // underlying error
}
```

## ProviderError

```ts
class ProviderError extends MarketFeedError {
  readonly statusCode?: number; // HTTP status, e.g. 404, 500
}
```

## RateLimitError

```ts
class RateLimitError extends MarketFeedError {
  readonly retryAfter?: Date; // earliest safe retry time
}
```

## AllProvidersFailedError

```ts
class AllProvidersFailedError extends Error {
  readonly errors: MarketFeedError[]; // one error per failed provider
}
```

## UnsupportedOperationError

```ts
class UnsupportedOperationError extends MarketFeedError {}
// message: Provider "yahoo" does not support "news".
```

## Import

```ts
import {
  MarketFeedError,
  ProviderError,
  RateLimitError,
  AllProvidersFailedError,
  UnsupportedOperationError,
} from "market-feed";
```
