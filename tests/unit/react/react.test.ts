// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAlerts, useOrderBook, useQuote, useStream, useWebSocket } from "../../../src/react/index.js";
import type { AlertConfig, AlertEvent } from "../../../src/alerts/types.js";
import type { QuoteEvent } from "../../../src/stream/types.js";
import type { Quote } from "../../../src/types/quote.js";
import type { MarketFeed } from "../../../src/client.js";
import type { OrderBookEvent } from "../../../src/ws/index.js";
import type { WsEvent, WsTrade } from "../../../src/ws/types.js";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("../../../src/stream/index.js", () => ({
  watch: vi.fn(),
}));

vi.mock("../../../src/alerts/index.js", () => ({
  watchAlerts: vi.fn(),
}));

vi.mock("../../../src/ws/index.js", () => ({
  connect: vi.fn(),
  getOrderBook: vi.fn(),
}));

import { watch } from "../../../src/stream/index.js";
import { watchAlerts } from "../../../src/alerts/index.js";
import { connect, getOrderBook } from "../../../src/ws/index.js";

const mockWatch = vi.mocked(watch);
const mockWatchAlerts = vi.mocked(watchAlerts);
const mockConnect = vi.mocked(connect);
const mockGetOrderBook = vi.mocked(getOrderBook);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    symbol: "AAPL",
    name: "Apple Inc.",
    price: 190,
    change: 2,
    changePercent: 1.06,
    open: 188,
    high: 191,
    low: 187,
    close: 190,
    previousClose: 188,
    volume: 50_000_000,
    currency: "USD",
    exchange: "NASDAQ",
    timestamp: new Date(),
    provider: "test",
    ...overrides,
  };
}

/** Duck-typed feed for hooks that only need quote(). */
const mockFeed = { quote: vi.fn() } as unknown as MarketFeed;

/** Yields events then waits for AbortSignal — avoids premature generator termination. */
async function* hangingGenerator<T>(events: T[], signal: AbortSignal): AsyncGenerator<T> {
  for (const ev of events) {
    yield ev;
  }
  await new Promise<void>((resolve) => {
    signal.addEventListener("abort", () => resolve(), { once: true });
  });
}

// ---------------------------------------------------------------------------
// useQuote — basic polling
// Tests use real timers + waitFor (fake timers conflict with waitFor internals)
// ---------------------------------------------------------------------------

describe("useQuote — basic polling", () => {
  afterEach(() => vi.clearAllMocks());

  it("starts in loading state", async () => {
    const source = { quote: vi.fn().mockResolvedValue([]) };
    const { result } = renderHook(() => useQuote(source, "AAPL"));
    // Check initial synchronous state before the first fetch resolves
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    // Let effects settle to avoid act() warnings on cleanup
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("returns quote data and clears loading after first fetch", async () => {
    const quote = makeQuote({ symbol: "AAPL" });
    const source = { quote: vi.fn().mockResolvedValue([quote]) };
    const { result } = renderHook(() => useQuote(source, "AAPL"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe(quote);
    expect(result.current.error).toBeNull();
  });

  it("polls at the specified interval", async () => {
    const source = { quote: vi.fn().mockResolvedValue([makeQuote()]) };
    const { unmount } = renderHook(() => useQuote(source, "AAPL", { intervalMs: 50 }));

    await waitFor(() => expect(source.quote).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(source.quote).toHaveBeenCalledTimes(2), { timeout: 500 });
    unmount();
  });

  it("sets error when fetch throws", async () => {
    const source = { quote: vi.fn().mockRejectedValue(new Error("network error")) };
    const { result } = renderHook(() => useQuote(source, "AAPL"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toBe("network error");
    expect(result.current.data).toBeNull();
  });

  it("does not fetch when enabled=false", async () => {
    const source = { quote: vi.fn() };
    const { result } = renderHook(() => useQuote(source, "AAPL", { enabled: false }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(source.quote).not.toHaveBeenCalled();
  });

  it("resets state and refetches when symbol changes", async () => {
    const source = { quote: vi.fn().mockResolvedValue([makeQuote({ symbol: "AAPL" })]) };
    const { result, rerender } = renderHook(
      ({ symbol }) => useQuote(source, symbol),
      { initialProps: { symbol: "AAPL" } },
    );

    await waitFor(() => expect(result.current.data?.symbol).toBe("AAPL"));

    source.quote.mockResolvedValue([makeQuote({ symbol: "MSFT" })]);
    rerender({ symbol: "MSFT" });

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => expect(result.current.data?.symbol).toBe("MSFT"));
  });

  it("clears interval on unmount", async () => {
    const source = { quote: vi.fn().mockResolvedValue([makeQuote()]) };
    const { unmount } = renderHook(() => useQuote(source, "AAPL", { intervalMs: 50 }));

    await waitFor(() => expect(source.quote).toHaveBeenCalledTimes(1));
    unmount();
    const callCountAfterUnmount = source.quote.mock.calls.length;

    // Wait longer than the interval — no new calls should occur after unmount
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(source.quote.mock.calls.length).toBe(callCountAfterUnmount);
  });
});

// ---------------------------------------------------------------------------
// useQuote — refetch
// ---------------------------------------------------------------------------

describe("useQuote — refetch", () => {
  afterEach(() => vi.clearAllMocks());

  it("refetch() triggers an immediate extra fetch", async () => {
    const source = { quote: vi.fn().mockResolvedValue([makeQuote()]) };
    const { result } = renderHook(() => useQuote(source, "AAPL", { intervalMs: 60_000 }));

    await waitFor(() => expect(source.quote).toHaveBeenCalledTimes(1));

    await act(async () => {
      result.current.refetch();
    });

    await waitFor(() => expect(source.quote).toHaveBeenCalledTimes(2));
  });
});

// ---------------------------------------------------------------------------
// useStream
// ---------------------------------------------------------------------------

describe("useStream", () => {
  afterEach(() => vi.clearAllMocks());

  it("initial state: null event, null error", () => {
    mockWatch.mockImplementation(async function* (_feed, _symbols, opts) {
      await new Promise<void>((resolve) => {
        opts?.signal?.addEventListener("abort", () => resolve(), { once: true });
      });
    });
    const { result } = renderHook(() => useStream(mockFeed, ["AAPL"]));
    expect(result.current.event).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("does not call watch when symbols is empty", () => {
    const { result } = renderHook(() => useStream(mockFeed, []));
    expect(mockWatch).not.toHaveBeenCalled();
    expect(result.current.event).toBeNull();
  });

  it("updates event state when generator yields", async () => {
    const ev: QuoteEvent = {
      type: "quote",
      symbol: "AAPL",
      quote: makeQuote(),
      timestamp: new Date(),
    };

    mockWatch.mockImplementation(async function* (_feed, _symbols, opts) {
      yield ev;
      await new Promise<void>((resolve) => {
        opts?.signal?.addEventListener("abort", () => resolve(), { once: true });
      });
    });

    const { result } = renderHook(() => useStream(mockFeed, ["AAPL"]));

    await waitFor(() => {
      expect(result.current.event).toEqual(ev);
    });
    expect(result.current.error).toBeNull();
  });

  it("holds the latest event when generator yields multiple times", async () => {
    const ev1: QuoteEvent = {
      type: "quote",
      symbol: "AAPL",
      quote: makeQuote({ price: 190 }),
      timestamp: new Date(),
    };
    const ev2: QuoteEvent = {
      type: "quote",
      symbol: "AAPL",
      quote: makeQuote({ price: 195 }),
      timestamp: new Date(),
    };

    mockWatch.mockImplementation(async function* (_feed, _symbols, opts) {
      yield ev1;
      yield ev2;
      await new Promise<void>((resolve) => {
        opts?.signal?.addEventListener("abort", () => resolve(), { once: true });
      });
    });

    const { result } = renderHook(() => useStream(mockFeed, ["AAPL"]));

    await waitFor(() => {
      expect(result.current.event).toEqual(ev2);
    });
  });

  it("sets error when generator throws (non-abort)", async () => {
    mockWatch.mockImplementation(async function* () {
      throw new Error("stream failed");
    });

    const { result } = renderHook(() => useStream(mockFeed, ["AAPL"]));

    await waitFor(() => {
      expect(result.current.error?.message).toBe("stream failed");
    });
  });

  it("aborts the generator when unmounted", async () => {
    let capturedSignal: AbortSignal | undefined;

    mockWatch.mockImplementation(async function* (_feed, _symbols, opts) {
      capturedSignal = opts?.signal;
      await new Promise<void>((resolve) => {
        opts?.signal?.addEventListener("abort", () => resolve(), { once: true });
      });
    });

    const { unmount } = renderHook(() => useStream(mockFeed, ["AAPL"]));

    await act(async () => {
      await Promise.resolve();
    });

    expect(capturedSignal?.aborted).toBe(false);
    unmount();
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("restarts stream when symbols change", async () => {
    mockWatch.mockImplementation(async function* (_feed, _symbols, opts) {
      await new Promise<void>((resolve) => {
        opts?.signal?.addEventListener("abort", () => resolve(), { once: true });
      });
    });

    const { rerender } = renderHook(
      ({ symbols }) => useStream(mockFeed, symbols),
      { initialProps: { symbols: ["AAPL"] } },
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockWatch).toHaveBeenCalledTimes(1);

    rerender({ symbols: ["AAPL", "MSFT"] });

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockWatch).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// useAlerts
// ---------------------------------------------------------------------------

describe("useAlerts", () => {
  afterEach(() => vi.clearAllMocks());

  const makeAlert = (symbol = "AAPL", threshold = 200): AlertConfig => ({
    symbol,
    condition: { type: "price_above", threshold },
    once: true,
  });

  const makeAlertEvent = (alert: AlertConfig, price = 205): AlertEvent => ({
    type: "triggered",
    alert,
    quote: makeQuote({ price }),
    triggeredAt: new Date(),
  });

  it("initial state: empty events, null error", () => {
    mockWatchAlerts.mockImplementation(async function* () {
      return;
    });
    const { result } = renderHook(() => useAlerts(mockFeed, [makeAlert()]));
    expect(result.current.events).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("does not call watchAlerts when alerts is empty", () => {
    const { result } = renderHook(() => useAlerts(mockFeed, []));
    expect(mockWatchAlerts).not.toHaveBeenCalled();
    expect(result.current.events).toEqual([]);
  });

  it("accumulates triggered alert events", async () => {
    const alert = makeAlert();
    const alertEvent = makeAlertEvent(alert);

    mockWatchAlerts.mockImplementation(async function* (_feed, _alerts, opts) {
      yield alertEvent;
      await new Promise<void>((resolve) => {
        opts?.signal?.addEventListener("abort", () => resolve(), { once: true });
      });
    });

    const { result } = renderHook(() => useAlerts(mockFeed, [alert]));

    await waitFor(() => {
      expect(result.current.events).toHaveLength(1);
    });
    expect(result.current.events[0]).toBe(alertEvent);
  });

  it("accumulates multiple events", async () => {
    const alert = makeAlert("AAPL", 150);
    const ev1 = makeAlertEvent(alert, 155);
    const ev2 = makeAlertEvent(alert, 160);

    mockWatchAlerts.mockImplementation(async function* (_feed, _alerts, opts) {
      yield* hangingGenerator([ev1, ev2], opts?.signal ?? new AbortController().signal);
    });

    const { result } = renderHook(() => useAlerts(mockFeed, [alert]));

    await waitFor(() => {
      expect(result.current.events).toHaveLength(2);
    });
  });

  it("clearEvents() resets the accumulated list", async () => {
    const alert = makeAlert();
    const alertEvent = makeAlertEvent(alert);

    mockWatchAlerts.mockImplementation(async function* (_feed, _alerts, opts) {
      yield alertEvent;
      await new Promise<void>((resolve) => {
        opts?.signal?.addEventListener("abort", () => resolve(), { once: true });
      });
    });

    const { result } = renderHook(() => useAlerts(mockFeed, [alert]));

    await waitFor(() => {
      expect(result.current.events).toHaveLength(1);
    });

    act(() => {
      result.current.clearEvents();
    });

    expect(result.current.events).toEqual([]);
  });

  it("sets error when generator throws (non-abort)", async () => {
    mockWatchAlerts.mockImplementation(async function* () {
      throw new Error("alerts failed");
    });

    const { result } = renderHook(() => useAlerts(mockFeed, [makeAlert()]));

    await waitFor(() => {
      expect(result.current.error?.message).toBe("alerts failed");
    });
  });

  it("aborts the generator when unmounted", async () => {
    let capturedSignal: AbortSignal | undefined;

    mockWatchAlerts.mockImplementation(async function* (_feed, _alerts, opts) {
      capturedSignal = opts?.signal;
      await new Promise<void>((resolve) => {
        opts?.signal?.addEventListener("abort", () => resolve(), { once: true });
      });
    });

    const { unmount } = renderHook(() => useAlerts(mockFeed, [makeAlert()]));

    await act(async () => {
      await Promise.resolve();
    });

    expect(capturedSignal?.aborted).toBe(false);
    unmount();
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("restarts generator when alert definitions change", async () => {
    mockWatchAlerts.mockImplementation(async function* (_feed, _alerts, opts) {
      await new Promise<void>((resolve) => {
        opts?.signal?.addEventListener("abort", () => resolve(), { once: true });
      });
    });

    const { rerender } = renderHook(
      ({ alerts }) => useAlerts(mockFeed, alerts),
      { initialProps: { alerts: [makeAlert("AAPL", 200)] } },
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockWatchAlerts).toHaveBeenCalledTimes(1);

    rerender({ alerts: [makeAlert("AAPL", 250)] });

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockWatchAlerts).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// useWebSocket — React Native compatible real-time WS hook
// ---------------------------------------------------------------------------

describe("useWebSocket", () => {
  afterEach(() => vi.clearAllMocks());

  const mockProvider = { name: "finnhub", quote: vi.fn(), historical: vi.fn(), search: vi.fn() };

  function makeTrade(price = 190): WsTrade {
    return { symbol: "AAPL", price, size: 100, timestamp: new Date() };
  }

  it("initial state: null event, null latestTrade, null error", () => {
    mockConnect.mockImplementation(async function* (_provider, _symbols, opts) {
      await new Promise<void>((resolve) => {
        opts?.signal?.addEventListener("abort", () => resolve(), { once: true });
      });
    });
    const { result } = renderHook(() => useWebSocket(mockProvider, ["AAPL"]));
    expect(result.current.event).toBeNull();
    expect(result.current.latestTrade).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("does not call connect when symbols is empty", () => {
    const { result } = renderHook(() => useWebSocket(mockProvider, []));
    expect(mockConnect).not.toHaveBeenCalled();
    expect(result.current.event).toBeNull();
  });

  it("updates event and latestTrade when a trade event arrives", async () => {
    const trade = makeTrade(195);
    const tradeEvent: WsEvent = { type: "trade", trade };

    mockConnect.mockImplementation(async function* (_provider, _symbols, opts) {
      yield tradeEvent;
      await new Promise<void>((resolve) => {
        opts?.signal?.addEventListener("abort", () => resolve(), { once: true });
      });
    });

    const { result } = renderHook(() => useWebSocket(mockProvider, ["AAPL"]));

    await waitFor(() => expect(result.current.event).not.toBeNull());
    expect(result.current.event).toEqual(tradeEvent);
    expect(result.current.latestTrade).toEqual(trade);
    expect(result.current.error).toBeNull();
  });

  it("updates event for non-trade events but does not change latestTrade", async () => {
    const connectedEvent: WsEvent = { type: "connected", provider: "finnhub" };

    mockConnect.mockImplementation(async function* (_provider, _symbols, opts) {
      yield connectedEvent;
      await new Promise<void>((resolve) => {
        opts?.signal?.addEventListener("abort", () => resolve(), { once: true });
      });
    });

    const { result } = renderHook(() => useWebSocket(mockProvider, ["AAPL"]));

    await waitFor(() => expect(result.current.event).not.toBeNull());
    expect(result.current.event).toEqual(connectedEvent);
    expect(result.current.latestTrade).toBeNull();
  });

  it("sets error when connect throws (non-abort)", async () => {
    mockConnect.mockImplementation(async function* () {
      throw new Error("ws failed");
    });

    const { result } = renderHook(() => useWebSocket(mockProvider, ["AAPL"]));

    await waitFor(() => expect(result.current.error?.message).toBe("ws failed"));
  });

  it("aborts the generator when unmounted", async () => {
    let capturedSignal: AbortSignal | undefined;

    mockConnect.mockImplementation(async function* (_provider, _symbols, opts) {
      capturedSignal = opts?.signal;
      await new Promise<void>((resolve) => {
        opts?.signal?.addEventListener("abort", () => resolve(), { once: true });
      });
    });

    const { unmount } = renderHook(() => useWebSocket(mockProvider, ["AAPL"]));

    await act(async () => { await Promise.resolve(); });

    expect(capturedSignal?.aborted).toBe(false);
    unmount();
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("restarts stream when symbols change", async () => {
    mockConnect.mockImplementation(async function* (_provider, _symbols, opts) {
      await new Promise<void>((resolve) => {
        opts?.signal?.addEventListener("abort", () => resolve(), { once: true });
      });
    });

    const { rerender } = renderHook(
      ({ symbols }) => useWebSocket(mockProvider, symbols),
      { initialProps: { symbols: ["AAPL"] } },
    );

    await act(async () => { await Promise.resolve(); });
    expect(mockConnect).toHaveBeenCalledTimes(1);

    rerender({ symbols: ["AAPL", "MSFT"] });

    await act(async () => { await Promise.resolve(); });
    expect(mockConnect).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// useOrderBook — top-of-book bid/ask hook
// ---------------------------------------------------------------------------

describe("useOrderBook", () => {
  afterEach(() => vi.clearAllMocks());

  const mockProvider = { name: "polygon", quote: vi.fn(), historical: vi.fn(), search: vi.fn() };

  function makeOrderBook(bid = 189.9, ask = 190.1): OrderBookEvent {
    return {
      symbol: "AAPL",
      bids: [{ price: bid, size: 200 }],
      asks: [{ price: ask, size: 150 }],
      timestamp: new Date(),
    };
  }

  it("initial state: null orderBook, null error", () => {
    mockGetOrderBook.mockImplementation(async function* (_provider, _symbol, opts) {
      await new Promise<void>((resolve) => {
        opts?.signal?.addEventListener("abort", () => resolve(), { once: true });
      });
    });
    const { result } = renderHook(() => useOrderBook(mockProvider, "AAPL"));
    expect(result.current.orderBook).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("updates orderBook when generator yields", async () => {
    const book = makeOrderBook();

    mockGetOrderBook.mockImplementation(async function* (_provider, _symbol, opts) {
      yield book;
      await new Promise<void>((resolve) => {
        opts?.signal?.addEventListener("abort", () => resolve(), { once: true });
      });
    });

    const { result } = renderHook(() => useOrderBook(mockProvider, "AAPL"));

    await waitFor(() => expect(result.current.orderBook).not.toBeNull());
    expect(result.current.orderBook).toEqual(book);
    expect(result.current.error).toBeNull();
  });

  it("holds the latest snapshot when generator yields multiple times", async () => {
    const book1 = makeOrderBook(189.9, 190.1);
    const book2 = makeOrderBook(190.0, 190.2);

    mockGetOrderBook.mockImplementation(async function* (_provider, _symbol, opts) {
      yield book1;
      yield book2;
      await new Promise<void>((resolve) => {
        opts?.signal?.addEventListener("abort", () => resolve(), { once: true });
      });
    });

    const { result } = renderHook(() => useOrderBook(mockProvider, "AAPL"));

    await waitFor(() => expect(result.current.orderBook).toEqual(book2));
  });

  it("sets error when generator throws (non-abort)", async () => {
    mockGetOrderBook.mockImplementation(async function* () {
      throw new Error("orderbook failed");
    });

    const { result } = renderHook(() => useOrderBook(mockProvider, "AAPL"));

    await waitFor(() => expect(result.current.error?.message).toBe("orderbook failed"));
  });

  it("aborts the generator when unmounted", async () => {
    let capturedSignal: AbortSignal | undefined;

    mockGetOrderBook.mockImplementation(async function* (_provider, _symbol, opts) {
      capturedSignal = opts?.signal;
      await new Promise<void>((resolve) => {
        opts?.signal?.addEventListener("abort", () => resolve(), { once: true });
      });
    });

    const { unmount } = renderHook(() => useOrderBook(mockProvider, "AAPL"));

    await act(async () => { await Promise.resolve(); });

    expect(capturedSignal?.aborted).toBe(false);
    unmount();
    expect(capturedSignal?.aborted).toBe(true);
  });
});
