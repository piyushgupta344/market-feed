import { ProviderError } from "../../errors.js";
import type { IbTwsProvider } from "../../providers/ibtws/index.js";
import type { AsyncQueue } from "../queue.js";
import type { WsEvent, WsOptions, WsTrade } from "../types.js";

// ---------------------------------------------------------------------------
// IB TWS Client Portal API WebSocket message shapes
// ---------------------------------------------------------------------------

/** Session status — sent by TWS when the connection is established. */
interface IbStsMessage {
  topic: "sts";
  args: {
    authenticated: boolean;
    competing: boolean;
    message: string;
  };
}

/** Market data snapshot / update — topic is "smd+{conid}" */
interface IbSmdMessage {
  topic: string;
  /** Last price (field 31) */
  "31"?: string;
  /** Bid price (field 84) */
  "84"?: string;
  /** Ask price (field 86) */
  "86"?: string;
  /** Total volume (field 88) */
  "88"?: string;
  /** Last trade size (field 7702) */
  "7702"?: string;
  /** Server-side update epoch ms */
  _updated?: number;
}

type IbWsMessage = IbStsMessage | IbSmdMessage | Record<string, unknown>;

/** Market data field IDs to subscribe: last, bid, ask, volume, last size */
const MD_FIELDS = ["31", "84", "86", "88", "7702"];

// ---------------------------------------------------------------------------
// connectIbTws
// ---------------------------------------------------------------------------

/**
 * Opens an IB TWS Client Portal API WebSocket connection and pushes
 * `WsEvent`s into `queue`.
 *
 * Prerequisites:
 *  - IB TWS or IB Gateway running locally with Client Portal API enabled
 *  - Session authenticated (log in via browser at localhost:5000)
 *  - Symbol → conid mapping provided in `IbTwsProvider.conidMap`
 *
 * Protocol:
 *  1. Connect to `ws://localhost:5000/v1/api/ws`
 *  2. Server sends: `{"topic":"sts","args":{"authenticated":true,...}}`
 *  3. Client subscribes: `smd+{conid}+{"fields":["31","84","86","88","7702"]}`
 *  4. Server streams: `{"topic":"smd+{conid}","31":"189.84","7702":"100",...}`
 *
 * Symbols without a conid entry in `conidMap` are silently skipped.
 */
export function connectIbTws(
  provider: IbTwsProvider,
  symbols: string[],
  queue: AsyncQueue<WsEvent>,
  options: WsOptions,
): void {
  const WS = resolveWsImpl(options);
  if (!WS) {
    queue.close(
      new ProviderError(
        "WebSocket is not available. Pass a wsImpl option (e.g. import WebSocket from 'ws').",
        "ibtws",
      ),
    );
    return;
  }

  // Build reverse map: conid → symbol (only for requested symbols with a known conid)
  const conidToSymbol = new Map<number, string>();
  for (const sym of symbols) {
    const conid = provider.conidMap[sym];
    if (conid !== undefined) conidToSymbol.set(conid, sym);
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
    const ws = new WS!(provider.wsBaseUrl);

    ws.onmessage = (event: MessageEvent) => {
      if (aborted || queue.isClosing) {
        intentionalClose = true;
        ws.close();
        return;
      }

      let msg: IbWsMessage;
      try {
        msg = JSON.parse(event.data as string) as IbWsMessage;
      } catch {
        return;
      }

      // Session status message
      if ((msg as IbStsMessage).topic === "sts") {
        const sts = msg as IbStsMessage;
        if (sts.args.authenticated) {
          attempt = 0;
          queue.push({ type: "connected", provider: "ibtws" });
          // Subscribe to level I market data for all known conids
          for (const [conid] of conidToSymbol) {
            ws.send(`smd+${conid}+${JSON.stringify({ fields: MD_FIELDS })}`);
          }
        } else {
          intentionalClose = true;
          queue.close(
            new ProviderError(
              "IB TWS session is not authenticated. Log in at localhost:5000 before connecting.",
              "ibtws",
            ),
          );
          ws.close();
        }
        return;
      }

      // Market data update: topic = "smd+{conid}"
      const smd = msg as IbSmdMessage;
      if (typeof smd.topic === "string" && smd.topic.startsWith("smd+")) {
        const conidStr = smd.topic.split("+")[1];
        if (!conidStr) return;
        const conid = Number(conidStr);
        const symbol = conidToSymbol.get(conid);
        if (!symbol) return;

        const priceStr = smd["31"];
        if (!priceStr) return;
        const price = Number.parseFloat(priceStr);
        if (Number.isNaN(price)) return;

        const sizeStr = smd["7702"];
        const size = sizeStr ? Number.parseFloat(sizeStr) : 0;

        const trade: WsTrade = {
          symbol,
          price,
          size,
          timestamp: smd._updated !== undefined ? new Date(smd._updated) : new Date(),
        };
        queue.push({ type: "trade", trade });
      }
    };

    ws.onerror = () => {
      if (aborted || queue.isClosing) return;
      queue.push({
        type: "error",
        error: new ProviderError("IB TWS WebSocket connection error", "ibtws"),
        recoverable: true,
      });
    };

    ws.onclose = () => {
      if (intentionalClose || aborted || queue.isClosing) return;

      attempt++;
      const reconnecting = attempt <= maxAttempts;
      queue.push({ type: "disconnected", provider: "ibtws", reconnecting, attempt });

      if (!reconnecting) {
        queue.close(
          new ProviderError(
            `IB TWS WebSocket disconnected after ${maxAttempts} reconnect attempts`,
            "ibtws",
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
