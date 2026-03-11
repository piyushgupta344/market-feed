import type { Quote } from "../types/quote.js";
import type { AlertCondition, AlertConfig, AlertEvent, AlertsOptions } from "./types.js";

export type { AlertCondition, AlertConfig, AlertEvent, AlertsOptions } from "./types.js";

interface QuoteFetcher {
  quote(symbols: string[]): Promise<Quote[]>;
}

function conditionMet(condition: AlertCondition, quote: Quote): boolean {
  switch (condition.type) {
    case "price_above":
      return quote.price > condition.threshold;
    case "price_below":
      return quote.price < condition.threshold;
    case "change_pct_above":
      return quote.changePercent > condition.threshold;
    case "change_pct_below":
      return quote.changePercent < condition.threshold;
    case "volume_above":
      return (quote.volume ?? 0) > condition.threshold;
  }
}

/**
 * Poll a quote feed and yield `AlertEvent` whenever a configured condition is met.
 *
 * - Resolves when all `once` alerts have fired, or when `options.signal` is aborted.
 * - Permanent alerts (once = false) run until the AbortSignal fires.
 * - Debounce suppresses re-fires within `debounceMs` milliseconds.
 *
 * @example
 * ```ts
 * import { watchAlerts } from "market-feed/alerts";
 * import { MarketFeed } from "market-feed";
 *
 * const feed = new MarketFeed();
 * const controller = new AbortController();
 *
 * for await (const event of watchAlerts(feed, [
 *   { symbol: "AAPL", condition: { type: "price_above", threshold: 200 }, once: true },
 * ], { signal: controller.signal })) {
 *   console.log(`AAPL crossed $200: $${event.quote.price}`);
 * }
 * ```
 */
export async function* watchAlerts(
  feed: QuoteFetcher,
  alerts: AlertConfig[],
  options?: AlertsOptions,
): AsyncGenerator<AlertEvent> {
  if (alerts.length === 0) return;

  const intervalMs = options?.intervalMs ?? 5_000;
  const signal = options?.signal;

  const lastFired = new Map<AlertConfig, number>();
  const active = new Set(alerts);

  while (active.size > 0) {
    if (signal?.aborted) return;

    const symbols = [...new Set([...active].map((a) => a.symbol))];

    let quotes: Quote[];
    try {
      quotes = await feed.quote(symbols);
    } catch {
      await sleep(intervalMs, signal);
      continue;
    }

    if (signal?.aborted) return;

    const quoteMap = new Map(quotes.map((q) => [q.symbol.toUpperCase(), q]));
    const now = Date.now();

    for (const alert of [...active]) {
      const quote = quoteMap.get(alert.symbol.toUpperCase());
      if (!quote) continue;

      if (!conditionMet(alert.condition, quote)) continue;

      // Debounce check
      const last = lastFired.get(alert);
      if (last !== undefined && alert.debounceMs && now - last < alert.debounceMs) continue;

      lastFired.set(alert, now);
      yield { type: "triggered", alert, quote, triggeredAt: new Date(now) };

      if (alert.once) active.delete(alert);
    }

    if (active.size === 0) break;
    await sleep(intervalMs, signal);
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}
