import type { MarketProvider } from "../types/provider.js";
import { connectFinnhub } from "./adapters/finnhub.js";
import { connectPolygon } from "./adapters/polygon.js";
import { connectPolling } from "./adapters/polling.js";
import { AsyncQueue } from "./queue.js";
import type { WsCapableProvider, WsEvent, WsOptions } from "./types.js";

export type { WsCapableProvider, WsEvent, WsOptions, WsTrade } from "./types.js";

// ---------------------------------------------------------------------------
// Internal: duck-type check for providers that expose a WS API key
// ---------------------------------------------------------------------------

function hasWsApiKey(provider: MarketProvider): provider is MarketProvider & WsCapableProvider {
  return (
    "wsApiKey" in provider &&
    typeof (provider as Record<string, unknown>)["wsApiKey"] === "string"
  );
}

// ---------------------------------------------------------------------------
// connect()
// ---------------------------------------------------------------------------

/**
 * Open a real-time WebSocket stream for the given symbols.
 *
 * - **`PolygonProvider`** and **`FinnhubProvider`** use native WebSocket trade
 *   feeds (tick-by-tick execution reports).
 * - All other providers (Yahoo Finance, Alpha Vantage) fall back to HTTP
 *   polling every 5 seconds.
 *
 * The generator yields a discriminated-union `WsEvent`:
 * - `"connected"` — the connection was established (or re-established after a
 *   reconnect)
 * - `"trade"` — a `WsTrade` with `symbol`, `price`, `size`, `timestamp`
 * - `"disconnected"` — the connection dropped; `reconnecting` indicates
 *   whether an automatic reconnect will follow
 * - `"error"` — a recoverable or fatal error
 *
 * **Node 21+, Bun, Deno, and Cloudflare Workers** all expose a global
 * `WebSocket` and work out of the box.
 *
 * **Node 18–20**: WebSocket is not available globally. Install the `ws` package
 * and pass it as `wsImpl`:
 * ```ts
 * import WebSocket from "ws";
 * connect(provider, ["AAPL"], { wsImpl: WebSocket as unknown as typeof globalThis.WebSocket })
 * ```
 *
 * @example
 * ```ts
 * import { connect } from "market-feed/ws";
 * import { MarketFeed, FinnhubProvider } from "market-feed";
 *
 * const provider = new FinnhubProvider({ apiKey: process.env.FINNHUB_KEY! });
 * const controller = new AbortController();
 *
 * for await (const event of connect(provider, ["AAPL", "MSFT"], { signal: controller.signal })) {
 *   if (event.type === "trade") {
 *     console.log(`${event.trade.symbol}: $${event.trade.price}`);
 *   }
 * }
 * ```
 */
export async function* connect(
  provider: MarketProvider,
  symbols: string[],
  options?: WsOptions,
): AsyncGenerator<WsEvent> {
  if (symbols.length === 0) return;

  const queue = new AsyncQueue<WsEvent>();
  const opts = options ?? {};

  if (hasWsApiKey(provider) && provider.name === "polygon") {
    connectPolygon(provider.wsApiKey, symbols, queue, opts);
  } else if (hasWsApiKey(provider) && provider.name === "finnhub") {
    connectFinnhub(provider.wsApiKey, symbols, queue, opts);
  } else {
    connectPolling(provider, symbols, queue, opts);
  }

  for await (const event of queue) {
    yield event;
  }
}
