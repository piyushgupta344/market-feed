import { ProviderError } from "../../errors.js";
import type { AlpacaProvider } from "../../providers/alpaca/index.js";
import type { AsyncQueue } from "../queue.js";
import type { WsEvent, WsOptions, WsTrade } from "../types.js";

// ---------------------------------------------------------------------------
// Alpaca WebSocket message shapes
// ---------------------------------------------------------------------------

interface AlpacaSuccessMessage {
  T: "success";
  msg: "connected" | "authenticated";
}

interface AlpacaErrorMessage {
  T: "error";
  code: number;
  msg: string;
}

interface AlpacaTradeMessage {
  T: "t";
  /** Symbol */
  S: string;
  /** Executed price */
  p: number;
  /** Size (shares) */
  s: number;
  /** Timestamp (RFC3339 nanoseconds) */
  t: string;
  /** Exchange */
  x?: string;
  /** Condition codes */
  c?: string[];
}

interface AlpacaSubscriptionMessage {
  T: "subscription";
  trades: string[];
}

type AlpacaWsMessage =
  | AlpacaSuccessMessage
  | AlpacaErrorMessage
  | AlpacaTradeMessage
  | AlpacaSubscriptionMessage;

const WS_BASE = "wss://stream.data.alpaca.markets/v2";

// ---------------------------------------------------------------------------
// connectAlpaca
// ---------------------------------------------------------------------------

/**
 * Opens an Alpaca WebSocket connection and pushes `WsEvent`s into `queue`.
 *
 * Auth sequence:
 *  1. Server sends: `[{"T":"success","msg":"connected"}]`
 *  2. Client sends: `{"action":"auth","key":"KEY_ID","secret":"SECRET_KEY"}`
 *  3. Server sends: `[{"T":"success","msg":"authenticated"}]`
 *  4. Client sends: `{"action":"subscribe","trades":["AAPL","MSFT"]}`
 *  5. Server streams: `[{"T":"t","S":"AAPL","p":189.84,"s":100,"t":"..."}]`
 *
 * Uses `provider.feed` to choose the WS endpoint:
 *  - "iex" → `wss://stream.data.alpaca.markets/v2/iex` (free)
 *  - "sip" → `wss://stream.data.alpaca.markets/v2/sip` (paid)
 */
export function connectAlpaca(
  provider: AlpacaProvider,
  symbols: string[],
  queue: AsyncQueue<WsEvent>,
  options: WsOptions,
): void {
  const WS = resolveWsImpl(options);
  if (!WS) {
    queue.close(
      new ProviderError(
        "WebSocket is not available. Pass a wsImpl option (e.g. import WebSocket from 'ws').",
        "alpaca",
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
    const url = `${WS_BASE}/${provider.feed}`;
    const ws = new WS!(url);

    ws.onmessage = (event: MessageEvent) => {
      if (aborted || queue.isClosing) {
        intentionalClose = true;
        ws.close();
        return;
      }

      let messages: AlpacaWsMessage[];
      try {
        messages = JSON.parse(event.data as string) as AlpacaWsMessage[];
      } catch {
        return;
      }

      for (const msg of messages) {
        if (msg.T === "success") {
          if (msg.msg === "connected") {
            ws.send(
              JSON.stringify({
                action: "auth",
                key: provider.wsApiKey,
                secret: provider.wsApiSecret,
              }),
            );
          } else if (msg.msg === "authenticated") {
            attempt = 0;
            queue.push({ type: "connected", provider: "alpaca" });
            ws.send(JSON.stringify({ action: "subscribe", trades: symbols }));
          }
        } else if (msg.T === "error") {
          intentionalClose = true;
          queue.close(
            new ProviderError(`Alpaca WebSocket error ${msg.code}: ${msg.msg}`, "alpaca"),
          );
          ws.close();
        } else if (msg.T === "t") {
          const t = msg as AlpacaTradeMessage;
          const trade: WsTrade = {
            symbol: t.S,
            price: t.p,
            size: t.s,
            timestamp: new Date(t.t),
          };
          queue.push({ type: "trade", trade });
        }
      }
    };

    ws.onerror = () => {
      if (aborted || queue.isClosing) return;
      queue.push({
        type: "error",
        error: new ProviderError("Alpaca WebSocket connection error", "alpaca"),
        recoverable: true,
      });
    };

    ws.onclose = () => {
      if (intentionalClose || aborted || queue.isClosing) return;

      attempt++;
      const reconnecting = attempt <= maxAttempts;
      queue.push({ type: "disconnected", provider: "alpaca", reconnecting, attempt });

      if (!reconnecting) {
        queue.close(
          new ProviderError(
            `Alpaca WebSocket disconnected after ${maxAttempts} reconnect attempts`,
            "alpaca",
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
