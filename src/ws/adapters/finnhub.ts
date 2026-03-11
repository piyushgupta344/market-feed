import { ProviderError } from "../../errors.js";
import type { AsyncQueue } from "../queue.js";
import type { WsEvent, WsOptions, WsTrade } from "../types.js";

// ---------------------------------------------------------------------------
// Finnhub WebSocket message shapes
// ---------------------------------------------------------------------------

interface FinnhubTradeTick {
  /** Executed price */
  p: number;
  /** Symbol */
  s: string;
  /** Timestamp in milliseconds */
  t: number;
  /** Volume */
  v: number;
  /** Condition codes */
  c?: number[];
}

type FinnhubWsMessage =
  | { type: "trade"; data: FinnhubTradeTick[] }
  | { type: "ping" }
  | { type: "error"; msg: string };

const WS_BASE = "wss://ws.finnhub.io";

// ---------------------------------------------------------------------------
// connectFinnhub
// ---------------------------------------------------------------------------

/**
 * Opens a Finnhub WebSocket connection and pushes `WsEvent`s into `queue`.
 *
 * Auth is via the token query param in the URL. On open, subscribe to each
 * symbol individually:
 *  `{"type":"subscribe","symbol":"AAPL"}`
 *
 * Trade messages arrive as:
 *  `{"type":"trade","data":[{"p":189.84,"s":"AAPL","t":1712345678000,"v":100}]}`
 */
export function connectFinnhub(
  apiKey: string,
  symbols: string[],
  queue: AsyncQueue<WsEvent>,
  options: WsOptions,
): void {
  const WS = resolveWsImpl(options);
  if (!WS) {
    queue.close(
      new ProviderError(
        "WebSocket is not available. Pass a wsImpl option (e.g. import WebSocket from 'ws').",
        "finnhub",
      ),
    );
    return;
  }

  const maxAttempts = options.maxReconnectAttempts ?? 10;
  const baseDelay = options.reconnectDelayMs ?? 1_000;
  let attempt = 0;
  let aborted = false;

  options.signal?.addEventListener(
    "abort",
    () => {
      aborted = true;
      queue.close();
    },
    { once: true },
  );

  function connect(): void {
    if (aborted || queue.isClosing) return;

    let intentionalClose = false;
    const ws = new WS!(`${WS_BASE}?token=${apiKey}`);

    ws.onopen = () => {
      if (aborted || queue.isClosing) {
        intentionalClose = true;
        ws.close();
        return;
      }
      attempt = 0;
      queue.push({ type: "connected", provider: "finnhub" });
      for (const symbol of symbols) {
        ws.send(JSON.stringify({ type: "subscribe", symbol }));
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      if (aborted || queue.isClosing) {
        intentionalClose = true;
        ws.close();
        return;
      }

      let msg: FinnhubWsMessage;
      try {
        msg = JSON.parse(event.data as string) as FinnhubWsMessage;
      } catch {
        return;
      }

      if (msg.type === "error") {
        queue.push({
          type: "error",
          error: new ProviderError(`Finnhub WebSocket error: ${msg.msg}`, "finnhub"),
          recoverable: true,
        });
        return;
      }

      if (msg.type !== "trade") return;

      for (const tick of msg.data) {
        const trade: WsTrade = {
          symbol: tick.s,
          price: tick.p,
          size: tick.v,
          timestamp: new Date(tick.t),
          ...(tick.c ? { conditions: tick.c } : {}),
        };
        queue.push({ type: "trade", trade });
      }
    };

    ws.onerror = () => {
      if (aborted || queue.isClosing) return;
      queue.push({
        type: "error",
        error: new ProviderError("Finnhub WebSocket connection error", "finnhub"),
        recoverable: true,
      });
    };

    ws.onclose = () => {
      if (intentionalClose || aborted || queue.isClosing) return;

      attempt++;
      const reconnecting = attempt <= maxAttempts;
      queue.push({ type: "disconnected", provider: "finnhub", reconnecting, attempt });

      if (!reconnecting) {
        queue.close(
          new ProviderError(
            `Finnhub WebSocket disconnected after ${maxAttempts} reconnect attempts`,
            "finnhub",
          ),
        );
        return;
      }

      const delay = Math.min(baseDelay * 2 ** (attempt - 1), 30_000);
      setTimeout(() => connect(), delay);
    };
  }

  connect();
}

function resolveWsImpl(options: WsOptions): typeof globalThis.WebSocket | undefined {
  if (options.wsImpl) return options.wsImpl;
  if (typeof WebSocket !== "undefined") return WebSocket;
  return undefined;
}
