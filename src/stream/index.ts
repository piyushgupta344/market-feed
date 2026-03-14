import { getSession } from "../calendar/session.js";
import type { MarketFeed } from "../client.js";
import type { MarketFeedError } from "../errors.js";
import type { TradingSession } from "../types/market.js";
import { getIntervalMs, sleep } from "./scheduler.js";
import type {
  DivergenceEvent,
  EarningsReleasedEvent,
  MarketCloseEvent,
  MarketOpenEvent,
  QuoteEvent,
  StreamErrorEvent,
  StreamEvent,
  WatchOptions,
} from "./types.js";

export type {
  StreamEvent,
  QuoteEvent,
  MarketOpenEvent,
  MarketCloseEvent,
  DivergenceEvent,
  StreamErrorEvent,
  EarningsReleasedEvent,
  WatchOptions,
  WatchIntervalOptions,
} from "./types.js";

/**
 * Yields a stream of typed market events for the given symbols.
 *
 * - Polls at `interval.open` (default 5s) during regular market hours.
 * - Polls at `interval.prepost` (default 30s) during pre/post market.
 * - When `marketHoursAware: true` (default), pauses at `interval.closed`
 *   (default 60s) when the market is closed rather than making live requests.
 * - Emits `market-open` / `market-close` events at session transitions.
 * - Emits `divergence` events when multiple providers disagree beyond
 *   `divergenceThreshold` percent.
 *
 * @example
 * ```ts
 * import { watch } from 'market-feed/stream';
 *
 * const feed = new MarketFeed();
 * const controller = new AbortController();
 *
 * for await (const event of watch(feed, ['AAPL', 'MSFT'], { signal: controller.signal })) {
 *   if (event.type === 'quote') console.log(event.symbol, event.quote.price);
 * }
 * ```
 */
export async function* watch(
  feed: MarketFeed,
  symbols: string[],
  options: WatchOptions = {},
): AsyncGenerator<StreamEvent, void, unknown> {
  if (symbols.length === 0) return;

  const exchange = options.exchange ?? "NYSE";
  const marketHoursAware = options.marketHoursAware ?? true;
  const divergenceThreshold = options.divergenceThreshold ?? 0.5;
  const maxErrors = options.maxErrors ?? 5;
  const fundamentalsIntervalMs = options.fundamentalsIntervalMs ?? 900_000;
  const { signal } = options;

  let lastSession: TradingSession | null = null;
  let consecutiveErrors = 0;

  // Per-symbol earnings tracking (only used when includeFundamentals: true)
  const lastEarningsTs = new Map<string, number>(); // symbol → last known earnings timestamp
  const lastEarningsCheck = new Map<string, number>(); // symbol → last check time

  while (!signal?.aborted) {
    // -----------------------------------------------------------------------
    // 1. Determine current session
    // -----------------------------------------------------------------------
    const session = getSession(exchange);

    // -----------------------------------------------------------------------
    // 2. Emit session transition events
    // -----------------------------------------------------------------------
    if (lastSession !== null && lastSession !== session) {
      if (lastSession === "closed" && session !== "closed") {
        const ev: MarketOpenEvent = {
          type: "market-open",
          exchange,
          session,
          timestamp: new Date(),
        };
        yield ev;
      } else if (lastSession !== "closed" && session === "closed") {
        const ev: MarketCloseEvent = {
          type: "market-close",
          exchange,
          session,
          timestamp: new Date(),
        };
        yield ev;
      }
    }
    lastSession = session;

    // -----------------------------------------------------------------------
    // 3. When closed and market-hours-aware, just wait and loop
    // -----------------------------------------------------------------------
    if (session === "closed" && marketHoursAware) {
      try {
        await sleep(getIntervalMs(session, options.interval), signal);
      } catch {
        // Aborted
        break;
      }
      continue;
    }

    // -----------------------------------------------------------------------
    // 4. Fetch quotes and emit QuoteEvents
    // -----------------------------------------------------------------------
    for (const symbol of symbols) {
      if (signal?.aborted) break;
      try {
        const quote = await feed.quote(symbol);
        consecutiveErrors = 0;
        const ev: QuoteEvent = { type: "quote", symbol, quote, timestamp: new Date() };
        yield ev;
      } catch (err) {
        consecutiveErrors++;
        const recoverable = consecutiveErrors < maxErrors;
        const ev: StreamErrorEvent = {
          type: "error",
          error: err as MarketFeedError,
          symbol,
          recoverable,
          timestamp: new Date(),
        };
        yield ev;
        if (!recoverable) {
          throw err;
        }
      }
    }

    // -----------------------------------------------------------------------
    // 5. Earnings monitoring (only when includeFundamentals: true)
    // -----------------------------------------------------------------------
    if (options.includeFundamentals && !signal?.aborted) {
      for (const symbol of symbols) {
        if (signal?.aborted) break;
        const lastCheck = lastEarningsCheck.get(symbol) ?? 0;
        if (Date.now() - lastCheck < fundamentalsIntervalMs) continue;
        lastEarningsCheck.set(symbol, Date.now());
        try {
          const earns = await feed.earnings(symbol, { limit: 1 });
          const latest = earns[0];
          if (!latest) continue;
          const latestTs = latest.date.getTime();
          const prevTs = lastEarningsTs.get(symbol);
          lastEarningsTs.set(symbol, latestTs);
          if (prevTs !== undefined && latestTs > prevTs) {
            const ev: EarningsReleasedEvent = {
              type: "earnings_released",
              symbol,
              earnings: latest,
              timestamp: new Date(),
            };
            yield ev;
          }
        } catch {
          // Non-critical — earnings check failure should not interrupt the stream
          lastEarningsCheck.set(symbol, Date.now());
        }
      }
    }

    // -----------------------------------------------------------------------
    // 6. Divergence detection (only when multiple providers are configured)
    // -----------------------------------------------------------------------
    if (!signal?.aborted && feed.providers.length > 1) {
      for (const symbol of symbols) {
        if (signal?.aborted) break;
        const results = await Promise.allSettled(feed.providers.map((p) => p.quote([symbol])));

        const quotes = results
          .filter(
            (
              r,
            ): r is PromiseFulfilledResult<
              Awaited<ReturnType<(typeof feed.providers)[0]["quote"]>>
            > => r.status === "fulfilled",
          )
          .flatMap((r) => r.value);

        if (quotes.length >= 2) {
          const prices = quotes.map((q) => q.price);
          const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
          const maxP = Math.max(...prices);
          const minP = Math.min(...prices);
          const spreadPct = ((maxP - minP) / mean) * 100;

          if (spreadPct > divergenceThreshold) {
            const ev: DivergenceEvent = {
              type: "divergence",
              symbol,
              quotes,
              spreadPct,
              timestamp: new Date(),
            };
            yield ev;
          }
        }
      }
    }

    // -----------------------------------------------------------------------
    // 7. Sleep until next poll
    // -----------------------------------------------------------------------
    try {
      await sleep(getIntervalMs(session, options.interval), signal);
    } catch {
      // Aborted
      break;
    }
  }
}
