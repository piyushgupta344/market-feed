import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderError } from "../../../src/errors.js";
import { getOrderBook } from "../../../src/ws/index.js";
import type { MarketProvider } from "../../../src/types/provider.js";
import type { Quote } from "../../../src/types/quote.js";

// ---------------------------------------------------------------------------
// MockWebSocket
// ---------------------------------------------------------------------------

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  readonly url: string;
  readyState = 1;
  readonly sentMessages: string[] = [];

  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  static reset() { MockWebSocket.instances = []; }
  static get latest(): MockWebSocket {
    const i = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    if (!i) throw new Error("No MockWebSocket instances");
    return i;
  }

  simulateMessage(data: string) {
    this.onmessage?.({ data, type: "message" } as MessageEvent);
  }

  simulateClose(code = 1006) {
    this.readyState = 3;
    this.onclose?.({ code, wasClean: code === 1000 } as unknown as CloseEvent);
  }

  send(data: string) { this.sentMessages.push(data); }
  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1000, wasClean: true } as unknown as CloseEvent);
  }
}

const WS_IMPL = MockWebSocket as unknown as typeof globalThis.WebSocket;

function makeQuote(price: number): Quote {
  return {
    symbol: "AAPL", name: "Apple Inc.", price,
    change: 0, changePercent: 0, open: price, high: price, low: price,
    close: price, previousClose: price, volume: 1_000_000,
    currency: "USD", exchange: "XNAS",
    timestamp: new Date("2026-03-12T14:00:00Z"),
    provider: "yahoo",
  };
}

// ---------------------------------------------------------------------------
// Polling fallback
// ---------------------------------------------------------------------------

describe("getOrderBook() — polling fallback", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("emits a synthetic 1-level book from quote price", async () => {
    const provider: MarketProvider = {
      name: "yahoo",
      quote: vi.fn().mockResolvedValue([makeQuote(189.84)]),
      historical: vi.fn(),
      search: vi.fn(),
    };

    const controller = new AbortController();
    const gen = getOrderBook(provider, "AAPL", {
      signal: controller.signal,
      pollIntervalMs: 0,
    });

    const e1 = await gen.next();
    controller.abort();

    expect(e1.done).toBe(false);
    expect(e1.value).toMatchObject({ symbol: "AAPL" });
    expect(e1.value?.bids).toHaveLength(1);
    expect(e1.value?.asks).toHaveLength(1);
    expect(e1.value!.bids[0]!.price).toBeLessThan(189.84);
    expect(e1.value!.asks[0]!.price).toBeGreaterThan(189.84);
  });

  it("stops cleanly on AbortSignal", async () => {
    const provider: MarketProvider = {
      name: "yahoo",
      quote: vi.fn().mockResolvedValue([makeQuote(100)]),
      historical: vi.fn(),
      search: vi.fn(),
    };

    const controller = new AbortController();
    const gen = getOrderBook(provider, "AAPL", { signal: controller.signal, pollIntervalMs: 0 });

    await gen.next(); // first event
    controller.abort();

    const result = await gen.next();
    expect(result.done).toBe(true);
  });

  it("silently continues on quote fetch error", async () => {
    vi.useRealTimers(); // override parent fake timers — need real setTimeout(1)
    let calls = 0;
    const provider: MarketProvider = {
      name: "yahoo",
      quote: vi.fn().mockImplementation(async () => {
        calls++;
        if (calls === 1) throw new ProviderError("Network error", "yahoo");
        return [makeQuote(190)];
      }),
      historical: vi.fn(),
      search: vi.fn(),
    };

    const controller = new AbortController();
    // pollIntervalMs: 1 → retry fires after 1 ms on real timers
    const gen = getOrderBook(provider, "AAPL", { signal: controller.signal, pollIntervalMs: 1 });

    // First error is swallowed; 2nd poll returns a quote
    const e = await gen.next();
    controller.abort();

    expect(e.done).toBe(false);
    expect(calls).toBeGreaterThanOrEqual(2); // confirmed retry happened
  });
});

// ---------------------------------------------------------------------------
// Polygon order book
// ---------------------------------------------------------------------------

describe("getOrderBook() — Polygon", () => {
  beforeEach(() => MockWebSocket.reset());

  function makePolygonProvider() {
    return {
      name: "polygon" as const,
      wsApiKey: "poly-key",
      quote: vi.fn(),
      historical: vi.fn(),
      search: vi.fn(),
    };
  }

  it("connects to Polygon stocks WS URL", () => {
    const provider = makePolygonProvider();
    const controller = new AbortController();
    getOrderBook(provider, "AAPL", { wsImpl: WS_IMPL, signal: controller.signal }).next();
    expect(MockWebSocket.latest.url).toBe("wss://socket.polygon.io/stocks");
    controller.abort();
  });

  it("subscribes to Q.AAPL after auth_success", () => {
    const provider = makePolygonProvider();
    const controller = new AbortController();
    getOrderBook(provider, "AAPL", { wsImpl: WS_IMPL, signal: controller.signal }).next();

    const ws = MockWebSocket.latest;
    ws.simulateMessage('[{"ev":"status","status":"connected"}]');
    ws.simulateMessage('[{"ev":"status","status":"auth_success"}]');

    expect(ws.sentMessages.some((m) => m.includes("Q.AAPL"))).toBe(true);
    controller.abort();
  });

  it("emits OrderBookEvent from Q message", async () => {
    const provider = makePolygonProvider();
    const controller = new AbortController();
    const gen = getOrderBook(provider, "AAPL", { wsImpl: WS_IMPL, signal: controller.signal });

    const p = gen.next();
    const ws = MockWebSocket.latest;
    ws.simulateMessage('[{"ev":"status","status":"connected"}]');
    ws.simulateMessage('[{"ev":"status","status":"auth_success"}]');
    ws.simulateMessage(
      JSON.stringify([{ ev: "Q", sym: "AAPL", bp: 189.83, bs: 5, ap: 189.85, as: 3, t: 1712345678000 }]),
    );

    const e = await p;
    controller.abort();

    expect(e.value).toMatchObject({ symbol: "AAPL" });
    expect(e.value!.bids[0]).toEqual({ price: 189.83, size: 5 });
    expect(e.value!.asks[0]).toEqual({ price: 189.85, size: 3 });
    expect(e.value!.timestamp).toBeInstanceOf(Date);
  });

  it("closes queue on auth_failed", async () => {
    const provider = makePolygonProvider();
    const gen = getOrderBook(provider, "AAPL", { wsImpl: WS_IMPL });

    const p = gen.next();
    const ws = MockWebSocket.latest;
    ws.simulateMessage('[{"ev":"status","status":"connected"}]');
    ws.simulateMessage('[{"ev":"status","status":"auth_failed"}]');

    await expect(p).rejects.toThrow("authentication failed");
  });
});

// ---------------------------------------------------------------------------
// Alpaca order book
// ---------------------------------------------------------------------------

describe("getOrderBook() — Alpaca", () => {
  beforeEach(() => MockWebSocket.reset());

  function makeAlpacaProvider(feed: "iex" | "sip" = "iex") {
    return {
      name: "alpaca" as const,
      feed,
      wsApiKey: "AK_TEST",
      wsApiSecret: "SK_TEST",
      quote: vi.fn(),
      historical: vi.fn(),
      search: vi.fn(),
    };
  }

  it("subscribes to quotes channel after authenticated", async () => {
    const provider = makeAlpacaProvider();
    const controller = new AbortController();
    const gen = getOrderBook(provider, "AAPL", { wsImpl: WS_IMPL, signal: controller.signal });

    const p = gen.next();
    const ws = MockWebSocket.latest;
    ws.simulateMessage(JSON.stringify([{ T: "success", msg: "connected" }]));
    ws.simulateMessage(JSON.stringify([{ T: "success", msg: "authenticated" }]));

    const subMsg = ws.sentMessages.find((m) => m.includes("subscribe"));
    expect(subMsg).toBeDefined();
    const parsed = JSON.parse(subMsg!) as { action: string; quotes: string[] };
    expect(parsed.quotes).toContain("AAPL");

    // Emit a quote update
    ws.simulateMessage(
      JSON.stringify([{ T: "q", S: "AAPL", bp: 189.83, bs: 10, ap: 189.85, as: 5, t: "2024-07-01T14:00:00Z" }]),
    );
    const e = await p;
    controller.abort();

    expect(e.value).toMatchObject({ symbol: "AAPL" });
    expect(e.value!.bids[0]).toEqual({ price: 189.83, size: 10 });
    expect(e.value!.asks[0]).toEqual({ price: 189.85, size: 5 });
  });
});

// ---------------------------------------------------------------------------
// IB TWS order book
// ---------------------------------------------------------------------------

describe("getOrderBook() — IB TWS", () => {
  beforeEach(() => MockWebSocket.reset());

  function makeIbTwsProvider() {
    return {
      name: "ibtws" as const,
      conidMap: { AAPL: 265598 } as Record<string, number>,
      wsBaseUrl: "ws://localhost:5000/v1/api/ws",
      quote: vi.fn(),
      historical: vi.fn(),
      search: vi.fn(),
    };
  }

  it("closes queue when conid is unknown", async () => {
    const provider = makeIbTwsProvider();
    const gen = getOrderBook(provider, "TSLA", { wsImpl: WS_IMPL });
    await expect(gen.next()).rejects.toThrow("No conid mapping");
  });

  it("emits OrderBookEvent from bid/ask smd fields", async () => {
    const provider = makeIbTwsProvider();
    const controller = new AbortController();
    const gen = getOrderBook(provider, "AAPL", { wsImpl: WS_IMPL, signal: controller.signal });

    const p = gen.next();
    const ws = MockWebSocket.latest;
    ws.simulateMessage(JSON.stringify({ topic: "sts", args: { authenticated: true, competing: false, message: "" } }));
    ws.simulateMessage(JSON.stringify({ topic: "smd+265598", "84": "189.83", "86": "189.85", _updated: 1712345678000 }));

    const e = await p;
    controller.abort();

    expect(e.value).toMatchObject({ symbol: "AAPL" });
    expect(e.value!.bids[0]!.price).toBe(189.83);
    expect(e.value!.asks[0]!.price).toBe(189.85);
  });

  it("closes queue when sts is not authenticated", async () => {
    const provider = makeIbTwsProvider();
    const gen = getOrderBook(provider, "AAPL", { wsImpl: WS_IMPL });

    const p = gen.next();
    const ws = MockWebSocket.latest;
    ws.simulateMessage(JSON.stringify({ topic: "sts", args: { authenticated: false, competing: false, message: "" } }));

    await expect(p).rejects.toThrow("not authenticated");
  });
});
