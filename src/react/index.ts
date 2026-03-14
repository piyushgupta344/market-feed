/**
 * market-feed/react
 *
 * React hooks for live market data.
 *
 * - `useQuote(source, symbol, options?)` — poll a quote at a regular interval
 * - `useStream(feed, symbols, options?)` — subscribe to a `watch()` stream
 * - `useAlerts(feed, alerts, options?)` — collect fired `watchAlerts()` events
 *
 * Requires React ≥ 18.
 *
 * @example
 * ```tsx
 * import { useQuote } from "market-feed/react";
 * import { MarketFeed } from "market-feed";
 *
 * const feed = new MarketFeed();
 *
 * function StockPrice({ symbol }: { symbol: string }) {
 *   const { data, loading, error } = useQuote(feed, symbol);
 *   if (loading) return <span>…</span>;
 *   if (error) return <span>Error: {error.message}</span>;
 *   return <span>{symbol}: ${data?.price.toFixed(2)}</span>;
 * }
 * ```
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { watchAlerts } from "../alerts/index.js";
import type { AlertConfig, AlertEvent, AlertsOptions } from "../alerts/types.js";
import type { MarketFeed } from "../client.js";
import { watch } from "../stream/index.js";
import type { StreamEvent, WatchOptions } from "../stream/types.js";
import type { MarketProvider } from "../types/provider.js";
import type { Quote } from "../types/quote.js";
import { connect, getOrderBook } from "../ws/index.js";
import type { OrderBookEvent, OrderBookOptions } from "../ws/index.js";
import type { WsEvent, WsOptions, WsTrade } from "../ws/types.js";

// ---------------------------------------------------------------------------
// Internal duck-typed source interface
// ---------------------------------------------------------------------------

interface QuoteSource {
  quote(symbols: string[]): Promise<Quote[]>;
}

// ---------------------------------------------------------------------------
// useQuote
// ---------------------------------------------------------------------------

export interface UseQuoteOptions {
  /** Poll interval in milliseconds. Defaults to 5 000. */
  intervalMs?: number;
  /** Set to false to suspend polling. Defaults to true. */
  enabled?: boolean;
}

export interface UseQuoteResult {
  /** The latest quote, or null before the first successful fetch. */
  data: Quote | null;
  /** True during the initial fetch before any data is available. */
  loading: boolean;
  /** The latest error, or null if the last fetch succeeded. */
  error: Error | null;
  /** Manually trigger an immediate re-fetch outside the interval. */
  refetch: () => void;
}

/**
 * Poll a quote at a regular interval and return the latest value.
 *
 * @param source - Any object with `quote(symbols[]) → Quote[]` (e.g. MarketFeed or a provider)
 * @param symbol - Ticker symbol to watch
 * @param options - Polling options
 */
export function useQuote(
  source: QuoteSource,
  symbol: string,
  options?: UseQuoteOptions,
): UseQuoteResult {
  const intervalMs = options?.intervalMs ?? 5_000;
  const enabled = options?.enabled ?? true;

  const [data, setData] = useState<Quote | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Stable ref so that swapping the source object does not restart polling
  const sourceRef = useRef(source);
  sourceRef.current = source;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setData(null);
    setError(null);

    let cancelled = false;

    async function doFetch() {
      try {
        const quotes = await sourceRef.current.quote([symbol]);
        if (!cancelled) {
          setData(quotes[0] ?? null);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    }

    void doFetch();
    const id = setInterval(() => void doFetch(), intervalMs);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbol, intervalMs, enabled]);

  const refetch = useCallback(() => {
    void (async () => {
      try {
        const quotes = await sourceRef.current.quote([symbol]);
        setData(quotes[0] ?? null);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    })();
  }, [symbol]);

  return { data, loading, error, refetch };
}

// ---------------------------------------------------------------------------
// useStream
// ---------------------------------------------------------------------------

export interface UseStreamResult {
  /** The latest stream event, or null before the first event arrives. */
  event: StreamEvent | null;
  /** Fatal error thrown by the stream (soft errors arrive as StreamErrorEvent). */
  error: Error | null;
}

/**
 * Subscribe to a `watch()` stream and return the latest event.
 *
 * The stream starts on mount and restarts automatically when `symbols` changes.
 * It is stopped when the component unmounts via an internal AbortSignal.
 *
 * @param feed - A MarketFeed instance
 * @param symbols - Symbols to watch
 * @param options - WatchOptions (excluding `signal`, which is managed internally)
 */
export function useStream(
  feed: MarketFeed,
  symbols: string[],
  options?: Omit<WatchOptions, "signal">,
): UseStreamResult {
  const [event, setEvent] = useState<StreamEvent | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Convert to a stable string key so the effect only restarts when the
  // symbol list actually changes, not on every array reference change.
  const symbolsKey = symbols.join(",");

  useEffect(() => {
    if (!symbolsKey) return;

    const symbolsArr = symbolsKey.split(",");
    const controller = new AbortController();

    async function run() {
      try {
        for await (const ev of watch(feed, symbolsArr, {
          ...optionsRef.current,
          signal: controller.signal,
        })) {
          setEvent(ev);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    }

    void run();
    return () => controller.abort();
  }, [feed, symbolsKey]);

  return { event, error };
}

// ---------------------------------------------------------------------------
// useAlerts
// ---------------------------------------------------------------------------

export interface UseAlertsResult {
  /** All alert events triggered since mount (or since the last clearEvents()). */
  events: AlertEvent[];
  /** Fatal error thrown by the watchAlerts generator. */
  error: Error | null;
  /** Clear the accumulated events list. */
  clearEvents: () => void;
}

/**
 * Subscribe to `watchAlerts()` and accumulate triggered alert events.
 *
 * The generator starts on mount and restarts when the alert definitions change
 * (keyed by symbol + condition type + threshold). It is stopped on unmount.
 *
 * @param feed - Any object with `quote(symbols[]) → Quote[]`
 * @param alerts - Alert configurations
 * @param options - AlertsOptions (excluding `signal`, which is managed internally)
 */
export function useAlerts(
  feed: QuoteSource,
  alerts: AlertConfig[],
  options?: Omit<AlertsOptions, "signal">,
): UseAlertsResult {
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const feedRef = useRef(feed);
  feedRef.current = feed;

  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Key by alert identity to restart the generator when alerts change
  const alertsKey = alerts
    .map((a) => `${a.symbol}:${a.condition.type}:${a.condition.threshold}`)
    .join("|");

  useEffect(() => {
    if (!alertsKey) return;

    const controller = new AbortController();

    async function run() {
      try {
        for await (const ev of watchAlerts(feedRef.current, alertsRef.current, {
          ...optionsRef.current,
          signal: controller.signal,
        })) {
          setEvents((prev) => [...prev, ev]);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    }

    void run();
    return () => controller.abort();
  }, [alertsKey]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { events, error, clearEvents };
}

// ---------------------------------------------------------------------------
// useWebSocket
// ---------------------------------------------------------------------------

export interface UseWebSocketResult {
  /** The latest WsEvent, or null before the first event arrives. */
  event: WsEvent | null;
  /** Shortcut for the most recent trade event's payload, or null. */
  latestTrade: WsTrade | null;
  /** Fatal error thrown by the stream. */
  error: Error | null;
}

/**
 * Subscribe to a real-time WebSocket stream and return the latest event.
 *
 * Uses `connect()` from `market-feed/ws`. Works in React Native (native
 * `WebSocket` is available globally in all RN versions). For Node 18–20, pass
 * `wsImpl` pointing to the `ws` package.
 *
 * The stream starts on mount and restarts automatically when `symbols` changes.
 * It is stopped when the component unmounts via an internal AbortSignal.
 *
 * @param provider - Any MarketProvider (Polygon, Finnhub, Alpaca, IbTws, or polling fallback)
 * @param symbols - Ticker symbols to subscribe to
 * @param options - WsOptions (excluding `signal`, which is managed internally)
 */
export function useWebSocket(
  provider: MarketProvider,
  symbols: string[],
  options?: Omit<WsOptions, "signal">,
): UseWebSocketResult {
  const [event, setEvent] = useState<WsEvent | null>(null);
  const [latestTrade, setLatestTrade] = useState<WsTrade | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const providerRef = useRef(provider);
  providerRef.current = provider;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const symbolsKey = symbols.join(",");

  useEffect(() => {
    if (!symbolsKey) return;

    const symbolsArr = symbolsKey.split(",");
    const controller = new AbortController();

    async function run() {
      try {
        for await (const ev of connect(providerRef.current, symbolsArr, {
          ...optionsRef.current,
          signal: controller.signal,
        })) {
          setEvent(ev);
          if (ev.type === "trade") {
            setLatestTrade(ev.trade);
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    }

    void run();
    return () => controller.abort();
  }, [symbolsKey]);

  return { event, latestTrade, error };
}

// ---------------------------------------------------------------------------
// useOrderBook
// ---------------------------------------------------------------------------

export interface UseOrderBookResult {
  /** The latest order book snapshot, or null before the first update. */
  orderBook: OrderBookEvent | null;
  /** Fatal error thrown by the order book generator. */
  error: Error | null;
}

/**
 * Subscribe to top-of-book bid/ask updates for a symbol.
 *
 * Uses `getOrderBook()` from `market-feed/ws`. Supports Polygon (Q.* quotes),
 * Alpaca (native quotes channel), IB TWS (bid/ask fields), and a polling
 * fallback for all other providers. Works in React Native.
 *
 * @param provider - Any MarketProvider
 * @param symbol - Ticker symbol to watch
 * @param options - OrderBookOptions (excluding `signal`, which is managed internally)
 */
export function useOrderBook(
  provider: MarketProvider,
  symbol: string,
  options?: Omit<OrderBookOptions, "signal">,
): UseOrderBookResult {
  const [orderBook, setOrderBook] = useState<OrderBookEvent | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const providerRef = useRef(provider);
  providerRef.current = provider;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!symbol) return;

    const controller = new AbortController();

    async function run() {
      try {
        for await (const update of getOrderBook(providerRef.current, symbol, {
          ...optionsRef.current,
          signal: controller.signal,
        })) {
          setOrderBook(update);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    }

    void run();
    return () => controller.abort();
  }, [symbol]);

  return { orderBook, error };
}
