import type { MarketFeedError } from "../errors.js";

// ---------------------------------------------------------------------------
// Trade tick — the unit emitted by WebSocket adapters
// ---------------------------------------------------------------------------

export interface WsTrade {
  /** Ticker symbol, e.g. "AAPL" */
  symbol: string;
  /** Executed price */
  price: number;
  /** Number of shares / units traded */
  size: number;
  /** When the trade was reported */
  timestamp: Date;
  /** Provider-specific condition codes, if available */
  conditions?: number[];
}

// ---------------------------------------------------------------------------
// Event union
// ---------------------------------------------------------------------------

export type WsEvent =
  | { type: "trade"; trade: WsTrade }
  | { type: "connected"; provider: string }
  | { type: "disconnected"; provider: string; reconnecting: boolean; attempt: number }
  | { type: "error"; error: MarketFeedError | Error; recoverable: boolean };

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface WsOptions {
  /**
   * Custom WebSocket constructor.
   *
   * Node 21+, Bun, Deno, and Cloudflare Workers expose `WebSocket` globally.
   * For Node 18–20, pass the `ws` package:
   *
   * ```ts
   * import WebSocket from "ws";
   * connect(provider, ["AAPL"], { wsImpl: WebSocket as unknown as typeof globalThis.WebSocket })
   * ```
   */
  wsImpl?: typeof globalThis.WebSocket;

  /**
   * Maximum reconnect attempts after unexpected disconnects.
   * Default: 10
   */
  maxReconnectAttempts?: number;

  /**
   * Base reconnect delay in ms. Doubles on each attempt, capped at 30 s.
   * Default: 1000
   */
  reconnectDelayMs?: number;

  /**
   * AbortSignal to stop the stream.
   */
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Marker interface for providers that expose a WS API key
// ---------------------------------------------------------------------------

/** Providers that support WebSocket streaming implement this interface. */
export interface WsCapableProvider {
  readonly wsApiKey: string;
}
