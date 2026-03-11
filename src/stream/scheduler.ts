import type { TradingSession } from "../types/market.js";
import type { WatchIntervalOptions } from "./types.js";

const DEFAULT_INTERVALS = {
  open: 5_000,
  prepost: 30_000,
  closed: 60_000,
} as const;

/** Return the polling interval in ms for the given session type. */
export function getIntervalMs(
  session: TradingSession,
  opts: WatchIntervalOptions | undefined,
): number {
  switch (session) {
    case "regular":
      return opts?.open ?? DEFAULT_INTERVALS.open;
    case "pre":
    case "post":
      return opts?.prepost ?? DEFAULT_INTERVALS.prepost;
    case "closed":
      return opts?.closed ?? DEFAULT_INTERVALS.closed;
  }
}

/**
 * Resolves after `ms` milliseconds.
 * Rejects immediately if the provided AbortSignal is already aborted,
 * or as soon as it fires during the wait.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Aborted"));
      return;
    }

    const timer = setTimeout(resolve, ms);

    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("Aborted"));
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
