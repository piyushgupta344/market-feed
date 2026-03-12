# WebSocket Streaming

`market-feed/ws` opens a persistent WebSocket connection to Polygon.io or Finnhub and yields individual trade executions in real time. For providers without native WebSocket support (Yahoo, Alpha Vantage), it falls back to HTTP polling automatically.

## Basic usage

```ts
import { connect } from "market-feed/ws";
import { FinnhubProvider } from "market-feed";

const provider = new FinnhubProvider({ apiKey: process.env.FINNHUB_KEY! });
const controller = new AbortController();

for await (const event of connect(provider, ["AAPL", "MSFT", "TSLA"], {
  signal: controller.signal,
})) {
  switch (event.type) {
    case "trade":
      console.log(`${event.trade.symbol}: $${event.trade.price} × ${event.trade.size}`);
      break;
    case "connected":
      console.log(`Connected to ${event.provider}`);
      break;
    case "disconnected":
      console.log(`Disconnected (attempt ${event.attempt})`);
      break;
  }
}

controller.abort();
```

## Event types

### `trade`

```ts
{
  type: "trade";
  trade: {
    symbol: string;
    price: number;
    size: number;
    timestamp: Date;
    conditions?: string[];
  };
}
```

### `connected` / `disconnected`

```ts
{ type: "connected";    provider: string; }
{ type: "disconnected"; provider: string; attempt: number; reconnecting: boolean; }
```

### `error`

```ts
{ type: "error"; error: Error; recoverable: boolean; }
```

## Provider support

| Provider | WebSocket | Notes |
|----------|-----------|-------|
| `PolygonProvider` | Native WS | Subscribes to `T.*` trade channel; auth via JSON handshake |
| `FinnhubProvider` | Native WS | Token in URL; per-symbol subscribe messages |
| `YahooProvider` | Polling fallback | Polls `quote()` every 5 s |
| `AlphaVantageProvider` | Polling fallback | Same as Yahoo |
| `TwelveDataProvider` | Polling fallback | Same as Yahoo |
| `TiingoProvider` | Polling fallback | Same as Yahoo |

## Options

```ts
interface WsOptions {
  /** Custom WebSocket constructor — required on Node 18–20. */
  wsImpl?: typeof WebSocket;

  /** Max reconnect attempts before giving up. Default: 10 */
  maxReconnectAttempts?: number;

  /** Base reconnect delay in ms. Doubles per attempt, capped at 30 s. Default: 1 000 */
  reconnectDelayMs?: number;

  /** AbortSignal to stop the stream. */
  signal?: AbortSignal;
}
```

## Node 18–20

Node 21+, Bun, Deno, and Cloudflare Workers expose `WebSocket` globally. For Node 18–20, install the `ws` package and inject it:

```bash
npm install ws
npm install --save-dev @types/ws
```

```ts
import WebSocket from "ws";
import { connect } from "market-feed/ws";
import { PolygonProvider } from "market-feed";

const provider = new PolygonProvider({ apiKey: process.env.POLYGON_KEY! });

for await (const event of connect(provider, ["AAPL"], {
  wsImpl: WebSocket as unknown as typeof globalThis.WebSocket,
})) {
  // ...
}
```

## Reconnection

The stream reconnects automatically on disconnect with exponential backoff:

```
attempt 1: wait 1 s
attempt 2: wait 2 s
attempt 3: wait 4 s
...
attempt 10: wait 30 s (max)
```

After `maxReconnectAttempts`, the generator terminates. Each reconnect resets the attempt counter on successful auth.

## vs. `market-feed/stream`

See the [HTTP Polling Stream](/modules/stream#vs-market-feed-ws) comparison table.
