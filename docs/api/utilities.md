# Utilities API

Exported helpers for use in custom provider implementations.

## RateLimiter

Token-bucket rate limiter.

```ts
import { RateLimiter } from "market-feed";

const limiter = new RateLimiter(
  providerName: string,
  capacity: number,    // max burst (tokens)
  refillRate: number,  // tokens per second
);
```

### Methods

```ts
// Consume 1 token. Throws RateLimitError if empty.
limiter.consume(count?: number): void

// Returns true if tokens >= count. Does NOT consume.
limiter.canConsume(count?: number): boolean

// Milliseconds until count tokens are available.
limiter.waitTimeMs(count?: number): number
```

### Example

```ts
// Finnhub free: 30 calls/second
const limiter = new RateLimiter("finnhub", 30, 30);

// Alpha Vantage free: 5 calls/minute
const limiter = new RateLimiter("alpha-vantage", 5, 5 / 60);
```

---

## Symbol utilities

```ts
import {
  normalise,
  stripExchange,
  toYahooSymbol,
  toAlphaVantageSymbol,
  toPolygonSymbol,
  dedupeSymbols,
} from "market-feed";
```

### `normalise(symbol)`

Uppercase and trim a symbol.

```ts
normalise("aapl ")  // → "AAPL"
```

### `stripExchange(symbol)`

Remove exchange suffix.

```ts
stripExchange("AAPL.NASDAQ")  // → "AAPL"
```

### `toYahooSymbol(symbol)`

Convert to Yahoo Finance format.

```ts
toYahooSymbol("BTC/USD")  // → "BTC-USD"
toYahooSymbol("aapl")     // → "AAPL"
```

### `toAlphaVantageSymbol(symbol)`

Convert to Alpha Vantage format.

```ts
toAlphaVantageSymbol("BTC-USD")  // → "BTCUSD"
toAlphaVantageSymbol("EUR/USD")  // → "EURUSD"
```

### `toPolygonSymbol(symbol)`

Convert to Polygon.io format.

```ts
toPolygonSymbol("BTC-USD")  // → "X:BTCUSD"
toPolygonSymbol("AAPL")     // → "AAPL"
```

### `dedupeSymbols(symbols)`

Deduplicate and normalise an array of symbols.

```ts
dedupeSymbols(["aapl", "AAPL", "msft"])  // → ["AAPL", "MSFT"]
```

---

## HttpClient

Internal fetch wrapper — exported for use in custom providers.

```ts
import { HttpClient } from "market-feed/http"; // or from "market-feed" if you need it
```

::: warning
`HttpClient` is exported for convenience when building custom providers but is not considered a stable public API. It may change between minor versions.
:::

```ts
const http = new HttpClient("my-provider", {
  baseUrl: "https://api.example.com",
  headers: { "X-API-Key": "secret" },
  timeoutMs: 8_000,
  retries: 3,
  retryDelayMs: 200,
});

const data = await http.get<MyResponse>("/endpoint", {
  params: { symbol: "AAPL", limit: 10 },
});
```
