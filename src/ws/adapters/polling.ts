import type { MarketProvider } from "../../types/provider.js";
import type { AsyncQueue } from "../queue.js";
import type { WsEvent, WsOptions, WsTrade } from "../types.js";

/** Interval between polling cycles, in ms. */
const POLL_INTERVAL_MS = 5_000;

/**
 * HTTP-polling fallback for providers that do not support WebSocket streaming
 * (Yahoo Finance, Alpha Vantage).
 *
 * Calls `provider.quote(symbols)` on a fixed interval and converts each Quote
 * into a `WsTrade` event using the quote's current price and volume.
 */
export function connectPolling(
  provider: MarketProvider,
  symbols: string[],
  queue: AsyncQueue<WsEvent>,
  options: WsOptions,
): void {
  let aborted = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  options.signal?.addEventListener(
    "abort",
    () => {
      aborted = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      queue.close();
    },
    { once: true },
  );

  queue.push({ type: "connected", provider: provider.name });

  async function poll(): Promise<void> {
    if (aborted || queue.isClosing) return;

    try {
      const quotes = await provider.quote(symbols);
      if (aborted || queue.isClosing) return;

      for (const quote of quotes) {
        const trade: WsTrade = {
          symbol: quote.symbol,
          price: quote.price,
          size: quote.volume,
          timestamp: quote.timestamp,
        };
        queue.push({ type: "trade", trade });
      }
    } catch (err) {
      if (!aborted && !queue.isClosing) {
        queue.push({
          type: "error",
          error: err instanceof Error ? err : new Error(String(err)),
          recoverable: true,
        });
      }
    }

    if (!aborted && !queue.isClosing) {
      timer = setTimeout(() => {
        void poll();
      }, POLL_INTERVAL_MS);
    }
  }

  void poll();
}
