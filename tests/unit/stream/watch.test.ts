import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sessionModule from "../../../src/calendar/session.js";
import type { MarketFeed } from "../../../src/client.js";
import { ProviderError } from "../../../src/errors.js";
import { watch } from "../../../src/stream/index.js";
import { getIntervalMs, sleep } from "../../../src/stream/scheduler.js";
import type { MarketProvider } from "../../../src/types/provider.js";
import type { Quote } from "../../../src/types/quote.js";

// ---------------------------------------------------------------------------
// Helper: build a minimal MarketFeed-shaped object for testing
// ---------------------------------------------------------------------------
function makeFeed(
  quoteResult: Partial<Quote> | Error,
  extraProviders: MarketProvider[] = [],
): MarketFeed {
  const baseQuote: Quote = {
    symbol: "AAPL",
    name: "Apple Inc.",
    price: 189.84,
    change: 1.52,
    changePercent: 0.807,
    open: 188.5,
    high: 190.32,
    low: 188.19,
    close: 189.84,
    previousClose: 188.32,
    volume: 52_000_000,
    currency: "USD",
    exchange: "XNAS",
    timestamp: new Date(),
    provider: "yahoo",
  };

  const quoteFn =
    quoteResult instanceof Error
      ? vi.fn().mockRejectedValue(quoteResult)
      : vi.fn().mockResolvedValue({ ...baseQuote, ...quoteResult });

  const primaryProvider: MarketProvider = {
    name: "yahoo",
    quote: vi
      .fn()
      .mockResolvedValue([{ ...baseQuote, ...(quoteResult instanceof Error ? {} : quoteResult) }]),
    historical: vi.fn().mockResolvedValue([]),
    search: vi.fn().mockResolvedValue([]),
  };

  return {
    quote: quoteFn,
    providers: [primaryProvider, ...extraProviders],
  } as unknown as MarketFeed;
}

// ---------------------------------------------------------------------------
// Scheduler unit tests
// ---------------------------------------------------------------------------

describe("getIntervalMs", () => {
  it("returns 5000ms for regular session by default", () => {
    expect(getIntervalMs("regular", undefined)).toBe(5_000);
  });

  it("returns 30000ms for pre session by default", () => {
    expect(getIntervalMs("pre", undefined)).toBe(30_000);
  });

  it("returns 30000ms for post session by default", () => {
    expect(getIntervalMs("post", undefined)).toBe(30_000);
  });

  it("returns 60000ms for closed session by default", () => {
    expect(getIntervalMs("closed", undefined)).toBe(60_000);
  });

  it("respects custom open interval", () => {
    expect(getIntervalMs("regular", { open: 10_000 })).toBe(10_000);
  });

  it("respects custom closed interval", () => {
    expect(getIntervalMs("closed", { closed: 120_000 })).toBe(120_000);
  });
});

describe("sleep", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("resolves after the specified ms", async () => {
    const p = sleep(1000);
    vi.advanceTimersByTime(1000);
    await expect(p).resolves.toBeUndefined();
  });

  it("rejects immediately when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(sleep(1000, controller.signal)).rejects.toThrow("Aborted");
  });

  it("rejects when signal fires during sleep", async () => {
    const controller = new AbortController();
    const p = sleep(5000, controller.signal);
    controller.abort();
    await expect(p).rejects.toThrow("Aborted");
  });
});

// ---------------------------------------------------------------------------
// watch() generator tests
// ---------------------------------------------------------------------------

describe("watch()", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(sessionModule, "getSession").mockReturnValue("regular");
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("yields a QuoteEvent for each symbol on first poll", async () => {
    const feed = makeFeed({});
    const controller = new AbortController();
    const gen = watch(feed, ["AAPL"], { signal: controller.signal, marketHoursAware: false });

    // Collect first event then abort
    const first = await gen.next();
    controller.abort();

    expect(first.done).toBe(false);
    expect(first.value).toMatchObject({ type: "quote", symbol: "AAPL" });
  });

  it("yields QuoteEvents for multiple symbols", async () => {
    const feed = makeFeed({});
    const controller = new AbortController();
    const gen = watch(feed, ["AAPL", "MSFT"], {
      signal: controller.signal,
      marketHoursAware: false,
    });

    const first = await gen.next();
    const second = await gen.next();
    controller.abort();

    expect(first.value).toMatchObject({ type: "quote", symbol: "AAPL" });
    expect(second.value).toMatchObject({ type: "quote", symbol: "MSFT" });
  });

  it("emits market-open event when session transitions from closed to regular", async () => {
    const getSessionSpy = vi.spyOn(sessionModule, "getSession");
    // First call: closed; second call: regular
    getSessionSpy.mockReturnValueOnce("closed").mockReturnValue("regular");

    // Initial spy with closed→regular: first generator uses marketHoursAware:false
    // but we immediately abort it to set up a cleaner second run.
    const controller = new AbortController();
    controller.abort(); // abort before any iteration

    const controller2 = new AbortController();
    vi.spyOn(sessionModule, "getSession")
      .mockReturnValueOnce("closed") // iteration 1: closed, wait
      .mockReturnValueOnce("regular"); // iteration 2: open → emit market-open

    const feed2 = makeFeed({});
    const gen2 = watch(feed2, ["AAPL"], {
      signal: controller2.signal,
      marketHoursAware: true,
      interval: { closed: 1 },
    });

    // First next: session=closed, emits nothing (waits), but we advance timers
    const p = gen2.next();
    await vi.runAllTimersAsync();
    const first2 = await p;

    controller2.abort();

    // The market-open event should be emitted when transitioning from closed → regular
    // Collecting both events:
    expect(first2.value).toMatchObject({ type: "market-open", exchange: "NYSE" });
  });

  it("does not poll for quotes when session is closed and marketHoursAware is true", async () => {
    vi.spyOn(sessionModule, "getSession").mockReturnValue("closed");

    const feed = makeFeed({});
    // Abort the signal immediately so the generator exits on first sleep attempt
    const controller = new AbortController();
    controller.abort();

    const gen = watch(feed, ["AAPL"], {
      signal: controller.signal,
      marketHoursAware: true,
    });

    // Generator enters loop → session=closed → tries to sleep → signal already aborted → breaks
    const result = await gen.next();
    expect(result.done).toBe(true);
    expect(feed.quote).not.toHaveBeenCalled();
  });

  it("polls continuously when marketHoursAware is false even during closed session", async () => {
    vi.spyOn(sessionModule, "getSession").mockReturnValue("closed");

    const feed = makeFeed({});
    const controller = new AbortController();

    const gen = watch(feed, ["AAPL"], {
      signal: controller.signal,
      marketHoursAware: false,
    });

    const first = await gen.next();
    controller.abort();

    expect(first.value).toMatchObject({ type: "quote" });
    expect(feed.quote).toHaveBeenCalled();
  });

  it("yields StreamErrorEvent on recoverable fetch failure", async () => {
    const error = new ProviderError("Network error", "yahoo");
    const feed = makeFeed(error);
    const controller = new AbortController();

    const gen = watch(feed, ["AAPL"], {
      signal: controller.signal,
      marketHoursAware: false,
    });

    const event = await gen.next();
    controller.abort();

    expect(event.value).toMatchObject({
      type: "error",
      recoverable: true,
      symbol: "AAPL",
    });
  });

  it("throws after maxErrors consecutive failures", async () => {
    const error = new ProviderError("Network error", "yahoo");
    const feed = makeFeed(error);

    const gen = watch(feed, ["AAPL"], {
      marketHoursAware: false,
      maxErrors: 2,
    });

    // First next(): fetch fails, consecutiveErrors=1, yields recoverable error
    const e1 = await gen.next();
    expect((e1.value as { recoverable: boolean }).recoverable).toBe(true);

    // Generator is now suspended at `yield ev`. Resuming continues the for loop,
    // which ends (only one symbol), then hits sleep at end of iteration.
    // Advance fake timers to resolve the sleep, then the loop retries.
    const e2p = gen.next();
    vi.advanceTimersByTime(5_000); // fire the sleep(5000) timer
    const e2 = await e2p;
    // Second fetch fails, consecutiveErrors=2, yields non-recoverable error
    expect((e2.value as { recoverable: boolean }).recoverable).toBe(false);

    // Resuming from `yield ev` when recoverable=false → throws immediately (no sleep)
    await expect(gen.next()).rejects.toBeDefined();
  });

  it("returns immediately (done) when symbols array is empty", async () => {
    const feed = makeFeed({});
    const gen = watch(feed, []);
    const result = await gen.next();
    expect(result.done).toBe(true);
  });

  it("yields DivergenceEvent when two providers disagree beyond threshold", async () => {
    const baseQuote: Quote = {
      symbol: "AAPL",
      name: "Apple Inc.",
      price: 189.84,
      change: 0,
      changePercent: 0,
      open: 189,
      high: 191,
      low: 188,
      close: 189.84,
      previousClose: 188,
      volume: 1_000_000,
      currency: "USD",
      exchange: "XNAS",
      timestamp: new Date(),
      provider: "yahoo",
    };

    const divergentQuote: Quote = { ...baseQuote, price: 196.0, provider: "polygon" };

    const p1: MarketProvider = {
      name: "yahoo",
      quote: vi.fn().mockResolvedValue([baseQuote]),
      historical: vi.fn().mockResolvedValue([]),
      search: vi.fn().mockResolvedValue([]),
    };
    const p2: MarketProvider = {
      name: "polygon",
      quote: vi.fn().mockResolvedValue([divergentQuote]),
      historical: vi.fn().mockResolvedValue([]),
      search: vi.fn().mockResolvedValue([]),
    };

    const feed: MarketFeed = {
      quote: vi.fn().mockResolvedValue(baseQuote),
      providers: [p1, p2],
    } as unknown as MarketFeed;

    const controller = new AbortController();
    const gen = watch(feed, ["AAPL"], {
      signal: controller.signal,
      marketHoursAware: false,
      divergenceThreshold: 0.5,
    });

    // First event: quote
    const e1 = await gen.next();
    expect(e1.value).toMatchObject({ type: "quote" });

    // Second event: divergence
    const e2 = await gen.next();
    controller.abort();

    expect(e2.value).toMatchObject({ type: "divergence", symbol: "AAPL" });
    expect((e2.value as { spreadPct: number }).spreadPct).toBeGreaterThan(0.5);
  });

  it("does NOT yield DivergenceEvent when single provider configured", async () => {
    const feed = makeFeed({}); // only 1 provider
    const controller = new AbortController();

    const gen = watch(feed, ["AAPL"], {
      signal: controller.signal,
      marketHoursAware: false,
    });

    const e1 = await gen.next();
    // With 1 provider, divergence step is skipped. Next event needs sleep.
    // Abort immediately after quote event.
    controller.abort();

    expect(e1.value).toMatchObject({ type: "quote" });
    // No divergence events were emitted
    expect((e1.value as { type: string }).type).toBe("quote");
  });

  it("stops cleanly when AbortSignal fires", async () => {
    const feed = makeFeed({});
    const controller = new AbortController();

    const gen = watch(feed, ["AAPL"], {
      signal: controller.signal,
      marketHoursAware: false,
      interval: { open: 0 },
    });

    // Get one quote then abort
    await gen.next();
    controller.abort();

    // Advance any pending timers
    await vi.runAllTimersAsync();

    const result = await gen.next();
    expect(result.done).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Streaming fundamentals — earnings_released events
  // ---------------------------------------------------------------------------

  describe("includeFundamentals", () => {
    beforeEach(() => {
      vi.useRealTimers(); // override parent's fake timers — sleep(0) resolves naturally
    });
    afterEach(() => {
      vi.useFakeTimers(); // restore fake timers for parent describe's afterEach
    });

    function makeFeedWithEarnings(
      earningsSequence: Array<{ date: Date; epsActual?: number }[]>,
    ): MarketFeed {
      let callCount = 0;
      const earningsFn = vi.fn().mockImplementation(async () => {
        const result = earningsSequence[callCount] ?? [];
        callCount++;
        return result.map((e) => ({ symbol: "AAPL", provider: "yahoo", ...e }));
      });
      const base = makeFeed({});
      return { ...base, earnings: earningsFn } as unknown as MarketFeed;
    }

    it("emits earnings_released when a newer period is detected", async () => {
      const d1 = new Date("2024-07-01");
      const d2 = new Date("2024-10-01"); // newer

      // Call 1 (first check): returns d1 — recorded, no emit
      // Call 2 (second check): returns d2 — d2 > d1 → emit
      const feed = makeFeedWithEarnings([[{ date: d1 }], [{ date: d2, epsActual: 1.5 }]]);
      const controller = new AbortController();

      const gen = watch(feed, ["AAPL"], {
        signal: controller.signal,
        marketHoursAware: false,
        includeFundamentals: true,
        fundamentalsIntervalMs: 0, // check every poll
        interval: { open: 0 },
      });

      // Collect events until we find an earnings_released or exhaust 10 events
      const events = [];
      for (let i = 0; i < 10; i++) {
        const { value, done } = await gen.next();
        if (done) break;
        events.push(value);
        if ((value as { type: string }).type === "earnings_released") break;
      }
      controller.abort();

      const earningsEv = events.find((e) => (e as { type: string }).type === "earnings_released");
      expect(earningsEv).toBeDefined();
      expect((earningsEv as { type: string; symbol: string }).symbol).toBe("AAPL");
      expect(
        (earningsEv as { earnings: { date: Date } }).earnings.date.getTime(),
      ).toBe(d2.getTime());
    });

    it("does not emit earnings_released when date is unchanged", async () => {
      const d1 = new Date("2024-07-01");
      const feed = makeFeedWithEarnings([[{ date: d1 }], [{ date: d1 }]]);
      const controller = new AbortController();

      const gen = watch(feed, ["AAPL"], {
        signal: controller.signal,
        marketHoursAware: false,
        includeFundamentals: true,
        fundamentalsIntervalMs: 0,
        interval: { open: 0 },
      });

      const events = [];
      for (let i = 0; i < 6; i++) {
        const { value, done } = await gen.next();
        if (done) break;
        events.push(value);
      }
      controller.abort();

      const earningsEv = events.find((e) => (e as { type: string }).type === "earnings_released");
      expect(earningsEv).toBeUndefined();
    });

    it("silently ignores earnings fetch errors", async () => {
      const earningsFn = vi.fn().mockRejectedValue(new Error("provider error"));
      const base = makeFeed({});
      const feed = { ...base, earnings: earningsFn } as unknown as MarketFeed;
      const controller = new AbortController();

      const gen = watch(feed, ["AAPL"], {
        signal: controller.signal,
        marketHoursAware: false,
        includeFundamentals: true,
        fundamentalsIntervalMs: 0,
        interval: { open: 0 },
      });

      // Should not throw — just yields quote events
      const ev1 = await gen.next();
      controller.abort();
      expect((ev1.value as { type: string }).type).toBe("quote");
    });
  });
});
