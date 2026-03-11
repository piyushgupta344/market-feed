import { ProviderError } from "../../errors.js";
import type { AsyncQueue } from "../queue.js";
import type { WsEvent, WsOptions, WsTrade } from "../types.js";

// ---------------------------------------------------------------------------
// Polygon WebSocket message shapes
// ---------------------------------------------------------------------------

interface PolygonStatusMessage {
  ev: "status";
  status: string;
  message?: string;
}

interface PolygonTradeMessage {
  ev: "T";
  sym: string;
  /** Executed price */
  p: number;
  /** Trade size (shares) */
  s: number;
  /** Trade timestamp in milliseconds */
  t: number;
  /** Exchange ID */
  x?: number;
  /** Condition codes */
  c?: number[];
}

type PolygonWsMessage = PolygonStatusMessage | PolygonTradeMessage;

const WS_URL = "wss://socket.polygon.io/stocks";

// ---------------------------------------------------------------------------
// connectPolygon
// ---------------------------------------------------------------------------

/**
 * Opens a Polygon.io WebSocket connection and pushes `WsEvent`s into `queue`.
 *
 * Auth sequence:
 *  1. Server sends: `[{"ev":"status","status":"connected"}]`
 *  2. Client sends: `{"action":"auth","params":"API_KEY"}`
 *  3. Server sends: `[{"ev":"status","status":"auth_success"}]`
 *  4. Client sends: `{"action":"subscribe","params":"T.AAPL,T.MSFT"}`
 *  5. Server streams: `[{"ev":"T","sym":"AAPL","p":189.84,"s":100,"t":...}]`
 */
export function connectPolygon(
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
        "polygon",
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
    const ws = new WS!(WS_URL);

    ws.onmessage = (event: MessageEvent) => {
      if (aborted || queue.isClosing) {
        intentionalClose = true;
        ws.close();
        return;
      }

      let messages: PolygonWsMessage[];
      try {
        messages = JSON.parse(event.data as string) as PolygonWsMessage[];
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
            queue.push({ type: "connected", provider: "polygon" });
            const params = symbols.map((sym) => `T.${sym}`).join(",");
            ws.send(JSON.stringify({ action: "subscribe", params }));
          } else if (s.status === "auth_failed") {
            intentionalClose = true;
            queue.close(new ProviderError("Polygon WebSocket authentication failed", "polygon"));
            ws.close();
          }
        } else if (msg.ev === "T") {
          const t = msg as PolygonTradeMessage;
          const trade: WsTrade = {
            symbol: t.sym,
            price: t.p,
            size: t.s,
            timestamp: new Date(t.t),
            ...(t.c ? { conditions: t.c } : {}),
          };
          queue.push({ type: "trade", trade });
        }
      }
    };

    ws.onerror = () => {
      if (aborted || queue.isClosing) return;
      queue.push({
        type: "error",
        error: new ProviderError("Polygon WebSocket connection error", "polygon"),
        recoverable: true,
      });
    };

    ws.onclose = () => {
      if (intentionalClose || aborted || queue.isClosing) return;

      attempt++;
      const reconnecting = attempt <= maxAttempts;
      queue.push({ type: "disconnected", provider: "polygon", reconnecting, attempt });

      if (!reconnecting) {
        queue.close(
          new ProviderError(
            `Polygon WebSocket disconnected after ${maxAttempts} reconnect attempts`,
            "polygon",
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
