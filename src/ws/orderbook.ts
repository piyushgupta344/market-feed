import { ProviderError } from "../errors.js";
import type { AlpacaProvider } from "../providers/alpaca/index.js";
import type { IbTwsProvider } from "../providers/ibtws/index.js";
import type { MarketProvider } from "../types/provider.js";
import { AsyncQueue } from "./queue.js";
import type { WsCapableProvider, WsOptions } from "./types.js";

// ---------------------------------------------------------------------------
// Order book types
// ---------------------------------------------------------------------------

/** A single price level in an order book. */
export interface OrderBookLevel {
  /** Price for this level */
  price: number;
  /** Aggregate size (shares / units) available at this price */
  size: number;
}

/** Emitted by `getOrderBook()` on each top-of-book update. */
export interface OrderBookEvent {
  symbol: string;
  /** Best bids, sorted by price descending (highest first) */
  bids: OrderBookLevel[];
  /** Best asks, sorted by price ascending (lowest first) */
  asks: OrderBookLevel[];
  timestamp: Date;
}

export interface OrderBookOptions extends WsOptions {
  /**
   * For polling-based providers: interval between quote polls in ms.
   * Default: 2 000
   */
  pollIntervalMs?: number;
}

// ---------------------------------------------------------------------------
// Internal Polygon NBBO types
// ---------------------------------------------------------------------------

interface PolygonQuoteMessage {
  ev: "Q";
  sym: string;
  /** Bid price */
  bp: number;
  /** Bid size */
  bs: number;
  /** Ask price */
  ap: number;
  /** Ask size */
  as: number;
  /** Timestamp ms */
  t: number;
}

interface PolygonStatusMessage {
  ev: "status";
  status: string;
}

// ---------------------------------------------------------------------------
// Internal Alpaca quote types
// ---------------------------------------------------------------------------

interface AlpacaQuoteMessage {
  T: "q";
  S: string;
  /** Bid price */
  bp: number;
  /** Bid size */
  bs: number;
  /** Ask price */
  ap: number;
  /** Ask size */
  as: number;
  /** Timestamp (RFC3339) */
  t: string;
}

// ---------------------------------------------------------------------------
// Helper: resolve WS constructor
// ---------------------------------------------------------------------------

function resolveWsImpl(options: WsOptions): typeof globalThis.WebSocket | undefined {
  if (options.wsImpl) return options.wsImpl;
  if (typeof WebSocket !== "undefined") return WebSocket;
  return undefined;
}

function hasWsApiKey(
  provider: MarketProvider,
): provider is MarketProvider & WsCapableProvider {
  return (
    "wsApiKey" in provider &&
    typeof (provider as Record<string, unknown>)["wsApiKey"] === "string"
  );
}

// ---------------------------------------------------------------------------
// Polygon NBBO order book
// ---------------------------------------------------------------------------

function connectPolygonOrderBook(
  apiKey: string,
  symbol: string,
  queue: AsyncQueue<OrderBookEvent>,
  options: OrderBookOptions,
): void {
  const WS = resolveWsImpl(options);
  if (!WS) {
    queue.close(
      new ProviderError(
        "WebSocket is not available. Pass a wsImpl option.",
        "polygon",
      ),
    );
    return;
  }

  const maxAttempts = options.maxReconnectAttempts ?? 10;
  const baseDelay = options.reconnectDelayMs ?? 1_000;
  let attempt = 0;
  let aborted = false;

  options.signal?.addEventListener("abort", () => {
    aborted = true;
    queue.close();
  }, { once: true });

  function connect(): void {
    if (aborted || queue.isClosing) return;
    let intentionalClose = false;
    const ws = new WS!("wss://socket.polygon.io/stocks");

    ws.onmessage = (event: MessageEvent) => {
      if (aborted || queue.isClosing) {
        intentionalClose = true;
        ws.close();
        return;
      }
      let messages: (PolygonStatusMessage | PolygonQuoteMessage)[];
      try {
        messages = JSON.parse(event.data as string) as (PolygonStatusMessage | PolygonQuoteMessage)[];
      } catch {
        return;
      }
      for (const msg of messages) {
        if (msg.ev === "status") {
          const s = msg as PolygonStatusMessage;
          if (s.status === "connected") {
            ws.send(JSON.stringify({ action: "auth", params: apiKey }));
          } else if (s.status === "auth_success") {
            attempt = 0;
            ws.send(JSON.stringify({ action: "subscribe", params: `Q.${symbol}` }));
          } else if (s.status === "auth_failed") {
            intentionalClose = true;
            queue.close(new ProviderError("Polygon WebSocket authentication failed", "polygon"));
            ws.close();
          }
        } else if (msg.ev === "Q") {
          const q = msg as PolygonQuoteMessage;
          queue.push({
            symbol: q.sym,
            bids: [{ price: q.bp, size: q.bs }],
            asks: [{ price: q.ap, size: q.as }],
            timestamp: new Date(q.t),
          });
        }
      }
    };

    ws.onerror = () => {
      if (aborted || queue.isClosing) return;
      // non-fatal, reconnect will fire via onclose
    };

    ws.onclose = () => {
      if (intentionalClose || aborted || queue.isClosing) return;
      attempt++;
      const reconnecting = attempt <= maxAttempts;
      if (!reconnecting) {
        queue.close(new ProviderError(`Polygon order book disconnected after ${maxAttempts} attempts`, "polygon"));
        return;
      }
      const delay = Math.min(baseDelay * 2 ** (attempt - 1), 30_000);
      setTimeout(() => connect(), delay);
    };
  }

  connect();
}

// ---------------------------------------------------------------------------
// Alpaca NBBO order book
// ---------------------------------------------------------------------------

function connectAlpacaOrderBook(
  provider: AlpacaProvider,
  symbol: string,
  queue: AsyncQueue<OrderBookEvent>,
  options: OrderBookOptions,
): void {
  const WS = resolveWsImpl(options);
  if (!WS) {
    queue.close(
      new ProviderError("WebSocket is not available. Pass a wsImpl option.", "alpaca"),
    );
    return;
  }

  const maxAttempts = options.maxReconnectAttempts ?? 10;
  const baseDelay = options.reconnectDelayMs ?? 1_000;
  let attempt = 0;
  let aborted = false;

  options.signal?.addEventListener("abort", () => {
    aborted = true;
    queue.close();
  }, { once: true });

  function connect(): void {
    if (aborted || queue.isClosing) return;
    let intentionalClose = false;
    const url = `wss://stream.data.alpaca.markets/v2/${provider.feed}`;
    const ws = new WS!(url);

    ws.onmessage = (event: MessageEvent) => {
      if (aborted || queue.isClosing) {
        intentionalClose = true;
        ws.close();
        return;
      }
      let messages: Array<{ T: string; msg?: string; code?: number; [k: string]: unknown }>;
      try {
        messages = JSON.parse(event.data as string) as typeof messages;
      } catch {
        return;
      }
      for (const msg of messages) {
        if (msg.T === "success" && msg.msg === "connected") {
          ws.send(JSON.stringify({ action: "auth", key: provider.wsApiKey, secret: provider.wsApiSecret }));
        } else if (msg.T === "success" && msg.msg === "authenticated") {
          attempt = 0;
          ws.send(JSON.stringify({ action: "subscribe", quotes: [symbol] }));
        } else if (msg.T === "error") {
          intentionalClose = true;
          queue.close(new ProviderError(`Alpaca order book error ${msg.code as number}: ${msg.msg as string}`, "alpaca"));
          ws.close();
        } else if (msg.T === "q") {
          const q = msg as unknown as AlpacaQuoteMessage;
          queue.push({
            symbol: q.S,
            bids: [{ price: q.bp, size: q.bs }],
            asks: [{ price: q.ap, size: q.as }],
            timestamp: new Date(q.t),
          });
        }
      }
    };

    ws.onerror = () => { /* reconnect via onclose */ };

    ws.onclose = () => {
      if (intentionalClose || aborted || queue.isClosing) return;
      attempt++;
      const reconnecting = attempt <= maxAttempts;
      if (!reconnecting) {
        queue.close(new ProviderError(`Alpaca order book disconnected after ${maxAttempts} attempts`, "alpaca"));
        return;
      }
      const delay = Math.min(baseDelay * 2 ** (attempt - 1), 30_000);
      setTimeout(() => connect(), delay);
    };
  }

  connect();
}

// ---------------------------------------------------------------------------
// IB TWS level I order book (uses bid/ask fields from smd subscription)
// ---------------------------------------------------------------------------

function connectIbTwsOrderBook(
  provider: IbTwsProvider,
  symbol: string,
  queue: AsyncQueue<OrderBookEvent>,
  options: OrderBookOptions,
): void {
  const WS = resolveWsImpl(options);
  if (!WS) {
    queue.close(
      new ProviderError("WebSocket is not available. Pass a wsImpl option.", "ibtws"),
    );
    return;
  }

  const conid = provider.conidMap[symbol];
  if (conid === undefined) {
    queue.close(
      new ProviderError(
        `No conid mapping for symbol "${symbol}" in IbTwsProvider.conidMap`,
        "ibtws",
      ),
    );
    return;
  }

  const maxAttempts = options.maxReconnectAttempts ?? 10;
  const baseDelay = options.reconnectDelayMs ?? 1_000;
  let attempt = 0;
  let aborted = false;

  options.signal?.addEventListener("abort", () => {
    aborted = true;
    queue.close();
  }, { once: true });

  function connect(): void {
    if (aborted || queue.isClosing) return;
    let intentionalClose = false;
    const ws = new WS!(provider.wsBaseUrl);

    ws.onmessage = (event: MessageEvent) => {
      if (aborted || queue.isClosing) {
        intentionalClose = true;
        ws.close();
        return;
      }
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(event.data as string) as Record<string, unknown>;
      } catch {
        return;
      }

      if (msg["topic"] === "sts") {
        const args = msg["args"] as { authenticated: boolean } | undefined;
        if (args?.authenticated) {
          attempt = 0;
          // Subscribe: bid (84), ask (86)
          ws.send(`smd+${conid}+${JSON.stringify({ fields: ["84", "86"] })}`);
        } else {
          intentionalClose = true;
          queue.close(new ProviderError("IB TWS session is not authenticated", "ibtws"));
          ws.close();
        }
        return;
      }

      if (typeof msg["topic"] === "string" && (msg["topic"] as string).startsWith("smd+")) {
        const bidStr = msg["84"] as string | undefined;
        const askStr = msg["86"] as string | undefined;
        if (!bidStr || !askStr) return;
        const bid = Number.parseFloat(bidStr);
        const ask = Number.parseFloat(askStr);
        if (Number.isNaN(bid) || Number.isNaN(ask)) return;
        const updated = msg["_updated"] as number | undefined;
        queue.push({
          symbol,
          bids: [{ price: bid, size: 0 }],
          asks: [{ price: ask, size: 0 }],
          timestamp: updated !== undefined ? new Date(updated) : new Date(),
        });
      }
    };

    ws.onerror = () => { /* reconnect via onclose */ };

    ws.onclose = () => {
      if (intentionalClose || aborted || queue.isClosing) return;
      attempt++;
      const reconnecting = attempt <= maxAttempts;
      if (!reconnecting) {
        queue.close(new ProviderError(`IB TWS order book disconnected after ${maxAttempts} attempts`, "ibtws"));
        return;
      }
      const delay = Math.min(baseDelay * 2 ** (attempt - 1), 30_000);
      setTimeout(() => connect(), delay);
    };
  }

  connect();
}

// ---------------------------------------------------------------------------
// Polling fallback — synthesises a 1-level book from quote price
// ---------------------------------------------------------------------------

function connectOrderBookPolling(
  provider: MarketProvider,
  symbol: string,
  queue: AsyncQueue<OrderBookEvent>,
  options: OrderBookOptions,
): void {
  const intervalMs = options.pollIntervalMs ?? 2_000;
  let aborted = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  options.signal?.addEventListener("abort", () => {
    aborted = true;
    if (timer !== null) clearTimeout(timer);
    queue.close();
  }, { once: true });

  async function poll(): Promise<void> {
    if (aborted || queue.isClosing) return;
    try {
      const quotes = await provider.quote([symbol]);
      if (aborted || queue.isClosing) return;
      const q = quotes[0];
      if (q) {
        // Synthesise a 1-level book from the last trade price
        const spread = q.price * 0.0001; // 1 bps synthetic spread
        queue.push({
          symbol: q.symbol,
          bids: [{ price: +(q.price - spread).toFixed(4), size: 0 }],
          asks: [{ price: +(q.price + spread).toFixed(4), size: 0 }],
          timestamp: q.timestamp,
        });
      }
    } catch (err) {
      if (!aborted && !queue.isClosing) {
        // non-fatal, continue polling
        void err;
      }
    }
    if (!aborted && !queue.isClosing) {
      timer = setTimeout(() => { void poll(); }, intervalMs);
    }
  }

  void poll();
}

// ---------------------------------------------------------------------------
// getOrderBook() — public API
// ---------------------------------------------------------------------------

/**
 * Yields top-of-book (level I) order book updates for a single symbol.
 *
 * - **`PolygonProvider`** — subscribes to the `Q.*` NBBO quote channel;
 *   emits `bids[0]` / `asks[0]` from Polygon's National Best Bid/Offer feed.
 * - **`AlpacaProvider`** — subscribes to the Alpaca `quotes` channel;
 *   emits best bid/ask from IEX or SIP feed.
 * - **`IbTwsProvider`** — subscribes to bid (field 84) and ask (field 86)
 *   from the IB Client Portal market data feed.
 * - **All other providers** — polls `provider.quote([symbol])` at
 *   `pollIntervalMs` (default 2 s) and synthesises a 1-level book.
 *
 * @example
 * ```ts
 * import { getOrderBook } from "market-feed/ws";
 * import { PolygonProvider } from "market-feed";
 *
 * const provider = new PolygonProvider({ apiKey: process.env.POLYGON_KEY! });
 * const controller = new AbortController();
 *
 * for await (const update of getOrderBook(provider, "AAPL", { signal: controller.signal })) {
 *   console.log(`AAPL  bid ${update.bids[0]?.price}  ask ${update.asks[0]?.price}`);
 * }
 * ```
 */
export async function* getOrderBook(
  provider: MarketProvider,
  symbol: string,
  options: OrderBookOptions = {},
): AsyncGenerator<OrderBookEvent, void, unknown> {
  const queue = new AsyncQueue<OrderBookEvent>();
  const opts = options;

  if (hasWsApiKey(provider) && provider.name === "polygon") {
    connectPolygonOrderBook(provider.wsApiKey, symbol, queue, opts);
  } else if (provider.name === "alpaca") {
    connectAlpacaOrderBook(provider as AlpacaProvider, symbol, queue, opts);
  } else if (provider.name === "ibtws") {
    connectIbTwsOrderBook(provider as IbTwsProvider, symbol, queue, opts);
  } else {
    connectOrderBookPolling(provider, symbol, queue, opts);
  }

  for await (const event of queue) {
    yield event;
  }
}
