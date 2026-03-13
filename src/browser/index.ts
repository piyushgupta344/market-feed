/**
 * market-feed/browser
 *
 * Browser-native build of market-feed with CORS proxy utilities.
 *
 * All providers use the native browser `fetch` and `WebSocket` APIs.
 * No Node.js dependencies required — suitable for direct use in browsers
 * without a bundler.
 *
 * **CORS note**: Most financial data providers (Yahoo Finance, Polygon, etc.)
 * do not send CORS headers, so direct browser requests are blocked. Use a
 * CORS proxy in development, or proxy API calls through your own server in
 * production.
 *
 * @example Using a CORS proxy in development
 * ```ts
 * import { YahooProvider, MarketFeed, createFetchWithProxy } from "market-feed/browser";
 *
 * const proxiedFetch = createFetchWithProxy("https://corsproxy.io/?");
 *
 * const feed = new MarketFeed({
 *   providers: [new YahooProvider({ fetchFn: proxiedFetch })],
 * });
 *
 * const quote = await feed.quote("AAPL");
 * console.log(quote.price);
 * ```
 */

// Re-export the complete market-feed API
export * from "../index.js";

// Re-export WebSocket streaming (uses native browser WebSocket — no wsImpl needed)
export {
  connect,
  getOrderBook,
} from "../ws/index.js";
export type {
  WsEvent,
  WsTrade,
  WsOptions,
  WsCapableProvider,
  OrderBookEvent,
  OrderBookLevel,
  OrderBookOptions,
} from "../ws/index.js";

// ---------------------------------------------------------------------------
// CORS proxy utilities — browser-specific
// ---------------------------------------------------------------------------

/**
 * Creates a `fetch`-compatible function that routes all HTTP requests through
 * a CORS proxy. Pass the returned function as `fetchFn` to any provider.
 *
 * @param proxyUrl - CORS proxy URL prefix.
 *   - corsproxy.io: `"https://corsproxy.io/?"`
 *   - allorigins: `"https://api.allorigins.win/raw?url="`
 *   - Your own: `"https://my-proxy.example.com/proxy?url="`
 *
 * @example
 * ```ts
 * import { createFetchWithProxy, YahooProvider, MarketFeed } from "market-feed/browser";
 *
 * const proxiedFetch = createFetchWithProxy("https://corsproxy.io/?");
 * const feed = new MarketFeed({
 *   providers: [new YahooProvider({ fetchFn: proxiedFetch })],
 * });
 * ```
 */
export function createFetchWithProxy(proxyUrl: string): typeof globalThis.fetch {
  // Capture the current fetch reference eagerly so that installCorsProxy can
  // replace globalThis.fetch without causing infinite recursion.
  const baseFetch = globalThis.fetch.bind(globalThis);
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const originalUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    const proxied = `${proxyUrl}${encodeURIComponent(originalUrl)}`;
    if (typeof input === "string" || input instanceof URL) {
      return baseFetch(proxied, init);
    }
    // Request object — clone with new URL
    return baseFetch(new Request(proxied, input as Request), init);
  };
}

/**
 * Patches `globalThis.fetch` to route all requests through a CORS proxy.
 *
 * Useful when you want all `fetch` calls in your app (not just market-feed)
 * to go through the proxy during development.
 *
 * @param proxyUrl - CORS proxy URL prefix
 * @returns A function that restores the original `fetch` when called
 *
 * @example
 * ```ts
 * import { installCorsProxy } from "market-feed/browser";
 *
 * const uninstall = installCorsProxy("https://corsproxy.io/?");
 * // ... all fetch() calls now go through the proxy
 * uninstall(); // restore original fetch
 * ```
 */
export function installCorsProxy(proxyUrl: string): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = createFetchWithProxy(proxyUrl);
  return () => {
    globalThis.fetch = original;
  };
}
