import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderError } from "../../../src/errors.js";
import { AsyncQueue } from "../../../src/ws/queue.js";
import { connect } from "../../../src/ws/index.js";
import type { MarketProvider } from "../../../src/types/provider.js";
import type { Quote } from "../../../src/types/quote.js";
import type { WsEvent } from "../../../src/ws/types.js";

// ---------------------------------------------------------------------------
// MockWebSocket — injected via wsImpl to avoid real network calls
// ---------------------------------------------------------------------------

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  readonly url: string;

  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;

  readonly sentMessages: string[] = [];
  static instances: MockWebSocket[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  static reset() {
    MockWebSocket.instances = [];
  }

  static get latest(): MockWebSocket {
    const inst = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    if (!inst) throw new Error("No MockWebSocket instances");
    return inst;
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.({ type: "open" } as Event);
  }

  simulateMessage(data: string) {
    this.onmessage?.({ data, type: "message" } as MessageEvent);
  }

  simulateError() {
    this.onerror?.({ type: "error" } as Event);
  }

  simulateClose(code = 1000, reason = "") {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({
      code,
      reason,
      wasClean: code === 1000,
      type: "close",
    } as unknown as CloseEvent);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string) {
    if (
      this.readyState === MockWebSocket.OPEN ||
      this.readyState === MockWebSocket.CONNECTING
    ) {
      this.readyState = MockWebSocket.CLOSED;
      // When we close intentionally, onclose fires — but adapters set intentionalClose=true
      // before calling ws.close(), so this is a no-op from the adapter's perspective.
      this.onclose?.({
        code: code ?? 1000,
        reason: reason ?? "",
        wasClean: true,
        type: "close",
      } as unknown as CloseEvent);
    }
  }
}

// Minimal Quote factory
function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    symbol: "AAPL",
    name: "Apple Inc.",
    price: 189.84,
    change: 1.5,
    changePercent: 0.8,
    open: 188.5,
    high: 190.3,
    low: 188.1,
    close: 189.84,
    previousClose: 188.3,
    volume: 52_000_000,
    currency: "USD",
    exchange: "XNAS",
    timestamp: new Date("2026-03-11T15:00:00Z"),
    provider: "yahoo",
    ...overrides,
  };
}

const WS_IMPL = MockWebSocket as unknown as typeof globalThis.WebSocket;

// ---------------------------------------------------------------------------
// AsyncQueue unit tests
// ---------------------------------------------------------------------------

describe("AsyncQueue", () => {
  it("buffers a push before a consumer arrives", async () => {
    const q = new AsyncQueue<number>();
    q.push(42);
    const iter = q[Symbol.asyncIterator]();
    const result = await iter.next();
    expect(result).toEqual({ value: 42, done: false });
  });

  it("resolves a waiting consumer immediately on push", async () => {
    const q = new AsyncQueue<number>();
    const iter = q[Symbol.asyncIterator]();
    const p = iter.next();
    q.push(99);
    const result = await p;
    expect(result).toEqual({ value: 99, done: false });
  });

  it("done after close()", async () => {
    const q = new AsyncQueue<number>();
    q.close();
    const iter = q[Symbol.asyncIterator]();
    const result = await iter.next();
    expect(result.done).toBe(true);
  });

  it("drains buffered items before done", async () => {
    const q = new AsyncQueue<number>();
    q.push(1);
    q.push(2);
    q.close();
    const collected: number[] = [];
    for await (const v of q) collected.push(v);
    expect(collected).toEqual([1, 2]);
  });

  it("rejects with error when closed with error", async () => {
    const q = new AsyncQueue<number>();
    const iter = q[Symbol.asyncIterator]();
    const p = iter.next();
    q.close(new Error("stream failed"));
    await expect(p).rejects.toThrow("stream failed");
  });

  it("drops pushes after close", () => {
    const q = new AsyncQueue<number>();
    q.close();
    expect(() => q.push(1)).not.toThrow();
    expect(q.isClosing).toBe(true);
  });

  it("close() is idempotent", () => {
    const q = new AsyncQueue<number>();
    q.close();
    expect(() => q.close()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// connect() — empty symbols
// ---------------------------------------------------------------------------

describe("connect() with empty symbols", () => {
  it("returns done immediately", async () => {
    const provider: MarketProvider = {
      name: "yahoo",
      quote: vi.fn(),
      historical: vi.fn(),
      search: vi.fn(),
    };
    const gen = connect(provider, []);
    const result = await gen.next();
    expect(result.done).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// connect() — polling fallback (Yahoo / Alpha Vantage)
// ---------------------------------------------------------------------------

describe("connect() — polling fallback", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("emits connected then trade events", async () => {
    const provider: MarketProvider = {
      name: "yahoo",
      quote: vi.fn().mockResolvedValue([makeQuote()]),
      historical: vi.fn(),
      search: vi.fn(),
    };

    const controller = new AbortController();
    const gen = connect(provider, ["AAPL"], { signal: controller.signal });

    const e1 = await gen.next();
    expect(e1.value).toMatchObject({ type: "connected", provider: "yahoo" });

    const e2 = await gen.next();
    expect(e2.value).toMatchObject({ type: "trade" });
    if (e2.value?.type === "trade") {
      expect(e2.value.trade.symbol).toBe("AAPL");
      expect(e2.value.trade.price).toBe(189.84);
    }

    controller.abort();
  });

  it("emits recoverable error on fetch failure", async () => {
    const provider: MarketProvider = {
      name: "yahoo",
      quote: vi.fn().mockRejectedValue(new ProviderError("Network error", "yahoo")),
      historical: vi.fn(),
      search: vi.fn(),
    };

    const controller = new AbortController();
    const gen = connect(provider, ["AAPL"], { signal: controller.signal });

    await gen.next(); // "connected"
    const e2 = await gen.next();
    expect(e2.value).toMatchObject({ type: "error", recoverable: true });

    controller.abort();
  });

  it("stops cleanly on AbortSignal", async () => {
    const provider: MarketProvider = {
      name: "yahoo",
      quote: vi.fn().mockResolvedValue([makeQuote()]),
      historical: vi.fn(),
      search: vi.fn(),
    };

    const controller = new AbortController();
    const gen = connect(provider, ["AAPL"], { signal: controller.signal });

    await gen.next(); // connected
    await gen.next(); // first trade (quote() resolves synchronously via mock)
    controller.abort();

    // After abort, queue is closed — generator should terminate
    const result = await gen.next();
    expect(result.done).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// connect() — Polygon WebSocket adapter
// ---------------------------------------------------------------------------
//
// NOTE: The correct async generator consumption pattern is:
//   const promise = gen.next();   // register consumer FIRST
//   ws.simulate...();             // trigger event synchronously (pushes to queue)
//   const event = await promise;  // get the event
//
// Never call gen.next() without awaiting it before expecting a later gen.next() to
// yield a specific event — the unawaited call would silently consume that event.

describe("connect() — Polygon WebSocket", () => {
  beforeEach(() => MockWebSocket.reset());

  function makePolygonProvider(): MarketProvider & { wsApiKey: string } {
    return {
      name: "polygon",
      wsApiKey: "poly-test-key",
      quote: vi.fn(),
      historical: vi.fn(),
      search: vi.fn(),
    };
  }

  it("creates WS connection to Polygon URL", () => {
    const provider = makePolygonProvider();
    const controller = new AbortController();
    connect(provider, ["AAPL"], { wsImpl: WS_IMPL, signal: controller.signal }).next();

    expect(MockWebSocket.latest.url).toBe("wss://socket.polygon.io/stocks");
    controller.abort();
  });

  it("sends auth message after receiving connected status", () => {
    const provider = makePolygonProvider();
    const controller = new AbortController();
    connect(provider, ["AAPL"], { wsImpl: WS_IMPL, signal: controller.signal }).next();

    const ws = MockWebSocket.latest;
    ws.simulateMessage('[{"ev":"status","status":"connected"}]');

    expect(ws.sentMessages).toContainEqual(
      JSON.stringify({ action: "auth", params: "poly-test-key" }),
    );
    controller.abort();
  });

  it("subscribes to T.SYMBOL and emits connected event after auth_success", async () => {
    const provider = makePolygonProvider();
    const controller = new AbortController();
    const gen = connect(provider, ["AAPL", "MSFT"], { wsImpl: WS_IMPL, signal: controller.signal });

    // Register consumer before triggering events
    const p = gen.next();
    const ws = MockWebSocket.latest;
    ws.simulateMessage('[{"ev":"status","status":"connected"}]');
    ws.simulateMessage('[{"ev":"status","status":"auth_success"}]');

    const event = await p;
    expect(event.value).toMatchObject({ type: "connected", provider: "polygon" });

    const subscribeMsg = ws.sentMessages.find((m) => m.includes("subscribe"));
    expect(subscribeMsg).toContain("T.AAPL");
    expect(subscribeMsg).toContain("T.MSFT");

    controller.abort();
  });

  it("emits trade events on T messages", async () => {
    const provider = makePolygonProvider();
    const controller = new AbortController();
    const gen = connect(provider, ["AAPL"], { wsImpl: WS_IMPL, signal: controller.signal });

    // Get connected event
    const p1 = gen.next();
    const ws = MockWebSocket.latest;
    ws.simulateMessage('[{"ev":"status","status":"connected"}]');
    ws.simulateMessage('[{"ev":"status","status":"auth_success"}]');
    const e1 = await p1;
    expect(e1.value).toMatchObject({ type: "connected" });

    // Get trade event
    const p2 = gen.next();
    ws.simulateMessage('[{"ev":"T","sym":"AAPL","p":189.84,"s":100,"t":1712345678000}]');
    const e2 = await p2;

    expect(e2.value).toMatchObject({ type: "trade" });
    if (e2.value?.type === "trade") {
      expect(e2.value.trade.symbol).toBe("AAPL");
      expect(e2.value.trade.price).toBe(189.84);
      expect(e2.value.trade.size).toBe(100);
      expect(e2.value.trade.timestamp).toBeInstanceOf(Date);
    }

    controller.abort();
  });

  it("closes queue with error on auth_failed", async () => {
    const provider = makePolygonProvider();
    const gen = connect(provider, ["AAPL"], { wsImpl: WS_IMPL });

    const p = gen.next();
    const ws = MockWebSocket.latest;
    ws.simulateMessage('[{"ev":"status","status":"connected"}]');
    ws.simulateMessage('[{"ev":"status","status":"auth_failed","message":"Invalid API key"}]');

    await expect(p).rejects.toThrow("authentication failed");
  });

  it("emits disconnected event on unexpected close", async () => {
    const provider = makePolygonProvider();
    const controller = new AbortController();
    const gen = connect(provider, ["AAPL"], {
      wsImpl: WS_IMPL,
      signal: controller.signal,
      reconnectDelayMs: 0,
    });

    // Get connected event
    const p1 = gen.next();
    const ws = MockWebSocket.latest;
    ws.simulateMessage('[{"ev":"status","status":"connected"}]');
    ws.simulateMessage('[{"ev":"status","status":"auth_success"}]');
    await p1;

    // Register consumer, then trigger close
    const p2 = gen.next();
    ws.simulateClose(1006, "Abnormal closure");

    const e2 = await p2;
    expect(e2.value).toMatchObject({
      type: "disconnected",
      provider: "polygon",
      reconnecting: true,
      attempt: 1,
    });

    controller.abort();
  });

  it("emits recoverable error on ws.onerror", async () => {
    const provider = makePolygonProvider();
    const controller = new AbortController();
    const gen = connect(provider, ["AAPL"], { wsImpl: WS_IMPL, signal: controller.signal });

    // Get connected event
    const p1 = gen.next();
    const ws = MockWebSocket.latest;
    ws.simulateMessage('[{"ev":"status","status":"connected"}]');
    ws.simulateMessage('[{"ev":"status","status":"auth_success"}]');
    await p1;

    // Register consumer, then trigger error
    const p2 = gen.next();
    ws.simulateError();

    const e2 = await p2;
    expect(e2.value).toMatchObject({ type: "error", recoverable: true });

    controller.abort();
  });
});

// ---------------------------------------------------------------------------
// connect() — Finnhub WebSocket adapter
// ---------------------------------------------------------------------------

describe("connect() — Finnhub WebSocket", () => {
  beforeEach(() => MockWebSocket.reset());

  function makeFinnhubProvider(): MarketProvider & { wsApiKey: string } {
    return {
      name: "finnhub",
      wsApiKey: "fh-test-key",
      quote: vi.fn(),
      historical: vi.fn(),
      search: vi.fn(),
    };
  }

  it("creates WS connection with token in URL", () => {
    const provider = makeFinnhubProvider();
    const controller = new AbortController();
    connect(provider, ["AAPL"], { wsImpl: WS_IMPL, signal: controller.signal }).next();

    expect(MockWebSocket.latest.url).toBe("wss://ws.finnhub.io?token=fh-test-key");
    controller.abort();
  });

  it("subscribes to symbols on open and emits connected event", async () => {
    const provider = makeFinnhubProvider();
    const controller = new AbortController();
    const gen = connect(provider, ["AAPL", "TSLA"], { wsImpl: WS_IMPL, signal: controller.signal });

    const p = gen.next();
    const ws = MockWebSocket.latest;
    ws.simulateOpen();

    const event = await p;
    expect(event.value).toMatchObject({ type: "connected", provider: "finnhub" });

    expect(ws.sentMessages).toContainEqual(JSON.stringify({ type: "subscribe", symbol: "AAPL" }));
    expect(ws.sentMessages).toContainEqual(JSON.stringify({ type: "subscribe", symbol: "TSLA" }));

    controller.abort();
  });

  it("emits trade events from Finnhub trade messages", async () => {
    const provider = makeFinnhubProvider();
    const controller = new AbortController();
    const gen = connect(provider, ["AAPL"], { wsImpl: WS_IMPL, signal: controller.signal });

    // Get connected event
    const p1 = gen.next();
    const ws = MockWebSocket.latest;
    ws.simulateOpen();
    await p1;

    // Get trade event
    const p2 = gen.next();
    ws.simulateMessage(
      JSON.stringify({
        type: "trade",
        data: [{ p: 189.84, s: "AAPL", t: 1712345678000, v: 200 }],
      }),
    );

    const e2 = await p2;
    expect(e2.value).toMatchObject({ type: "trade" });
    if (e2.value?.type === "trade") {
      expect(e2.value.trade.symbol).toBe("AAPL");
      expect(e2.value.trade.price).toBe(189.84);
      expect(e2.value.trade.size).toBe(200);
    }

    controller.abort();
  });

  it("emits multiple trade events from a batched message", async () => {
    const provider = makeFinnhubProvider();
    const controller = new AbortController();
    const gen = connect(provider, ["AAPL", "MSFT"], { wsImpl: WS_IMPL, signal: controller.signal });

    // Get connected event
    const p1 = gen.next();
    const ws = MockWebSocket.latest;
    ws.simulateOpen();
    await p1;

    // Pre-register two consumers before sending a batched message
    const p2 = gen.next();
    const p3 = gen.next();
    ws.simulateMessage(
      JSON.stringify({
        type: "trade",
        data: [
          { p: 189.84, s: "AAPL", t: 1712345678000, v: 100 },
          { p: 420.5, s: "MSFT", t: 1712345679000, v: 50 },
        ],
      }),
    );

    const e2 = await p2;
    const e3 = await p3;

    expect((e2.value as WsEvent & { type: "trade" }).trade.symbol).toBe("AAPL");
    expect((e3.value as WsEvent & { type: "trade" }).trade.symbol).toBe("MSFT");

    controller.abort();
  });

  it("emits disconnected event on unexpected close", async () => {
    const provider = makeFinnhubProvider();
    const controller = new AbortController();
    const gen = connect(provider, ["AAPL"], {
      wsImpl: WS_IMPL,
      signal: controller.signal,
      reconnectDelayMs: 0,
    });

    // Get connected event
    const p1 = gen.next();
    const ws = MockWebSocket.latest;
    ws.simulateOpen();
    await p1;

    // Register consumer, then trigger close
    const p2 = gen.next();
    ws.simulateClose(1006, "Abnormal closure");

    const e2 = await p2;
    expect(e2.value).toMatchObject({
      type: "disconnected",
      provider: "finnhub",
      reconnecting: true,
    });

    controller.abort();
  });

  it("stops and closes queue on AbortSignal", async () => {
    const provider = makeFinnhubProvider();
    const controller = new AbortController();
    const gen = connect(provider, ["AAPL"], { wsImpl: WS_IMPL, signal: controller.signal });

    const p1 = gen.next();
    const ws = MockWebSocket.latest;
    ws.simulateOpen();
    await p1; // connected

    // Abort BEFORE calling gen.next() — queue is closed synchronously
    controller.abort();

    // Generator resumes, sees closed queue, exits
    const result = await gen.next();
    expect(result.done).toBe(true);
  });

  it("ignores ping messages (no event emitted)", async () => {
    const provider = makeFinnhubProvider();
    const controller = new AbortController();
    const gen = connect(provider, ["AAPL"], { wsImpl: WS_IMPL, signal: controller.signal });

    const p1 = gen.next();
    const ws = MockWebSocket.latest;
    ws.simulateOpen();
    await p1; // connected

    // Send a ping — no event should be enqueued
    ws.simulateMessage(JSON.stringify({ type: "ping" }));

    // Trade follows immediately — should arrive without a spurious event in between
    const p2 = gen.next();
    ws.simulateMessage(
      JSON.stringify({ type: "trade", data: [{ p: 190, s: "AAPL", t: 1712345000000, v: 10 }] }),
    );

    const e2 = await p2;
    expect(e2.value).toMatchObject({ type: "trade" });

    controller.abort();
  });
});

// ---------------------------------------------------------------------------
// Provider wsApiKey getter
// ---------------------------------------------------------------------------

describe("wsApiKey getter", () => {
  it("PolygonProvider exposes wsApiKey", async () => {
    const { PolygonProvider } = await import("../../../src/providers/polygon/index.js");
    const p = new PolygonProvider({ apiKey: "my-poly-key" });
    expect(p.wsApiKey).toBe("my-poly-key");
  });

  it("FinnhubProvider exposes wsApiKey", async () => {
    const { FinnhubProvider } = await import("../../../src/providers/finnhub/index.js");
    const p = new FinnhubProvider({ apiKey: "my-fh-key" });
    expect(p.wsApiKey).toBe("my-fh-key");
  });
});

// ---------------------------------------------------------------------------
// connect() — Alpaca WebSocket adapter
// ---------------------------------------------------------------------------

describe("connect() — Alpaca WebSocket", () => {
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

  it("connects to the correct IEX feed URL", () => {
    const provider = makeAlpacaProvider("iex");
    const controller = new AbortController();
    connect(provider, ["AAPL"], { wsImpl: WS_IMPL, signal: controller.signal }).next();
    expect(MockWebSocket.latest.url).toBe("wss://stream.data.alpaca.markets/v2/iex");
    controller.abort();
  });

  it("connects to the SIP feed URL when configured", () => {
    const provider = makeAlpacaProvider("sip");
    const controller = new AbortController();
    connect(provider, ["AAPL"], { wsImpl: WS_IMPL, signal: controller.signal }).next();
    expect(MockWebSocket.latest.url).toBe("wss://stream.data.alpaca.markets/v2/sip");
    controller.abort();
  });

  it("sends auth after connected message", () => {
    const provider = makeAlpacaProvider();
    const controller = new AbortController();
    connect(provider, ["AAPL"], { wsImpl: WS_IMPL, signal: controller.signal }).next();

    const ws = MockWebSocket.latest;
    ws.simulateMessage(JSON.stringify([{ T: "success", msg: "connected" }]));

    expect(ws.sentMessages).toContainEqual(
      JSON.stringify({ action: "auth", key: "AK_TEST", secret: "SK_TEST" }),
    );
    controller.abort();
  });

  it("emits connected and subscribes after authenticated", async () => {
    const provider = makeAlpacaProvider();
    const controller = new AbortController();
    const gen = connect(provider, ["AAPL", "MSFT"], { wsImpl: WS_IMPL, signal: controller.signal });

    const p = gen.next();
    const ws = MockWebSocket.latest;
    ws.simulateMessage(JSON.stringify([{ T: "success", msg: "connected" }]));
    ws.simulateMessage(JSON.stringify([{ T: "success", msg: "authenticated" }]));

    const event = await p;
    expect(event.value).toMatchObject({ type: "connected", provider: "alpaca" });

    const subMsg = ws.sentMessages.find((m) => m.includes("subscribe"));
    expect(subMsg).toBeDefined();
    const parsed = JSON.parse(subMsg!) as { action: string; trades: string[] };
    expect(parsed.action).toBe("subscribe");
    expect(parsed.trades).toContain("AAPL");
    expect(parsed.trades).toContain("MSFT");

    controller.abort();
  });

  it("emits trade events from T messages", async () => {
    const provider = makeAlpacaProvider();
    const controller = new AbortController();
    const gen = connect(provider, ["AAPL"], { wsImpl: WS_IMPL, signal: controller.signal });

    // connected
    const p1 = gen.next();
    const ws = MockWebSocket.latest;
    ws.simulateMessage(JSON.stringify([{ T: "success", msg: "connected" }]));
    ws.simulateMessage(JSON.stringify([{ T: "success", msg: "authenticated" }]));
    await p1;

    // trade
    const p2 = gen.next();
    ws.simulateMessage(
      JSON.stringify([{ T: "t", S: "AAPL", p: 189.84, s: 100, t: "2024-07-01T14:00:00.000Z", x: "D" }]),
    );
    const e2 = await p2;
    expect(e2.value).toMatchObject({ type: "trade" });
    if (e2.value?.type === "trade") {
      expect(e2.value.trade.symbol).toBe("AAPL");
      expect(e2.value.trade.price).toBe(189.84);
      expect(e2.value.trade.size).toBe(100);
    }

    controller.abort();
  });

  it("closes queue on auth error message", async () => {
    const provider = makeAlpacaProvider();
    const gen = connect(provider, ["AAPL"], { wsImpl: WS_IMPL });

    const p = gen.next();
    const ws = MockWebSocket.latest;
    ws.simulateMessage(JSON.stringify([{ T: "success", msg: "connected" }]));
    ws.simulateMessage(JSON.stringify([{ T: "error", code: 403, msg: "forbidden" }]));

    await expect(p).rejects.toThrow("forbidden");
  });

  it("emits disconnected on unexpected close", async () => {
    const provider = makeAlpacaProvider();
    const controller = new AbortController();
    const gen = connect(provider, ["AAPL"], {
      wsImpl: WS_IMPL,
      signal: controller.signal,
      reconnectDelayMs: 0,
    });

    const p1 = gen.next();
    const ws = MockWebSocket.latest;
    ws.simulateMessage(JSON.stringify([{ T: "success", msg: "connected" }]));
    ws.simulateMessage(JSON.stringify([{ T: "success", msg: "authenticated" }]));
    await p1;

    const p2 = gen.next();
    ws.simulateClose(1006, "Abnormal closure");

    const e2 = await p2;
    expect(e2.value).toMatchObject({ type: "disconnected", provider: "alpaca", reconnecting: true });

    controller.abort();
  });
});

// ---------------------------------------------------------------------------
// connect() — IB TWS WebSocket adapter
// ---------------------------------------------------------------------------

describe("connect() — IB TWS WebSocket", () => {
  beforeEach(() => MockWebSocket.reset());

  function makeIbTwsProvider() {
    return {
      name: "ibtws" as const,
      conidMap: { AAPL: 265598, MSFT: 272093 } as Record<string, number>,
      wsBaseUrl: "ws://localhost:5000/v1/api/ws",
      quote: vi.fn(),
      historical: vi.fn(),
      search: vi.fn(),
    };
  }

  it("connects to localhost TWS URL", () => {
    const provider = makeIbTwsProvider();
    const controller = new AbortController();
    connect(provider, ["AAPL"], { wsImpl: WS_IMPL, signal: controller.signal }).next();
    expect(MockWebSocket.latest.url).toBe("ws://localhost:5000/v1/api/ws");
    controller.abort();
  });

  it("emits connected and subscribes to conids after authenticated sts", async () => {
    const provider = makeIbTwsProvider();
    const controller = new AbortController();
    const gen = connect(provider, ["AAPL", "MSFT"], { wsImpl: WS_IMPL, signal: controller.signal });

    const p = gen.next();
    const ws = MockWebSocket.latest;
    ws.simulateMessage(
      JSON.stringify({ topic: "sts", args: { authenticated: true, competing: false, message: "" } }),
    );

    const event = await p;
    expect(event.value).toMatchObject({ type: "connected", provider: "ibtws" });

    // Should have sent smd+ subscription for both conids
    const subMsgs = ws.sentMessages.filter((m) => m.startsWith("smd+"));
    expect(subMsgs.some((m) => m.startsWith("smd+265598+"))).toBe(true); // AAPL
    expect(subMsgs.some((m) => m.startsWith("smd+272093+"))).toBe(true); // MSFT

    controller.abort();
  });

  it("closes queue when sts reports unauthenticated", async () => {
    const provider = makeIbTwsProvider();
    const gen = connect(provider, ["AAPL"], { wsImpl: WS_IMPL });

    const p = gen.next();
    const ws = MockWebSocket.latest;
    ws.simulateMessage(
      JSON.stringify({ topic: "sts", args: { authenticated: false, competing: false, message: "" } }),
    );

    await expect(p).rejects.toThrow("not authenticated");
  });

  it("emits trade events from smd market data updates", async () => {
    const provider = makeIbTwsProvider();
    const controller = new AbortController();
    const gen = connect(provider, ["AAPL"], { wsImpl: WS_IMPL, signal: controller.signal });

    // connected
    const p1 = gen.next();
    const ws = MockWebSocket.latest;
    ws.simulateMessage(
      JSON.stringify({ topic: "sts", args: { authenticated: true, competing: false, message: "" } }),
    );
    await p1;

    // market data update for AAPL conid 265598
    const p2 = gen.next();
    ws.simulateMessage(
      JSON.stringify({ topic: "smd+265598", "31": "189.84", "7702": "100", _updated: 1712345678000 }),
    );
    const e2 = await p2;

    expect(e2.value).toMatchObject({ type: "trade" });
    if (e2.value?.type === "trade") {
      expect(e2.value.trade.symbol).toBe("AAPL");
      expect(e2.value.trade.price).toBe(189.84);
      expect(e2.value.trade.size).toBe(100);
    }

    controller.abort();
  });

  it("skips smd updates for unknown conids", async () => {
    const provider = makeIbTwsProvider();
    const controller = new AbortController();
    const gen = connect(provider, ["AAPL"], { wsImpl: WS_IMPL, signal: controller.signal });

    const p1 = gen.next();
    const ws = MockWebSocket.latest;
    ws.simulateMessage(
      JSON.stringify({ topic: "sts", args: { authenticated: true, competing: false, message: "" } }),
    );
    await p1;

    // conid 99999 is not in conidMap — should not emit
    ws.simulateMessage(JSON.stringify({ topic: "smd+99999", "31": "50.00" }));

    // A real AAPL update follows — should be the next event
    const p2 = gen.next();
    ws.simulateMessage(
      JSON.stringify({ topic: "smd+265598", "31": "189.84", "7702": "50" }),
    );
    const e2 = await p2;
    expect(e2.value).toMatchObject({ type: "trade" });
    if (e2.value?.type === "trade") {
      expect(e2.value.trade.symbol).toBe("AAPL");
    }

    controller.abort();
  });

  it("AlpacaProvider exposes wsApiKey and wsApiSecret", async () => {
    const { AlpacaProvider } = await import("../../../src/providers/alpaca/index.js");
    const p = new AlpacaProvider({ keyId: "AK123", secretKey: "SK456" });
    expect(p.wsApiKey).toBe("AK123");
    expect(p.wsApiSecret).toBe("SK456");
    expect(p.feed).toBe("iex");
  });

  it("IbTwsProvider wsBaseUrl uses ws:// by default", async () => {
    const { IbTwsProvider } = await import("../../../src/providers/ibtws/index.js");
    const p = new IbTwsProvider({ conidMap: { AAPL: 265598 } });
    expect(p.wsBaseUrl).toBe("ws://localhost:5000/v1/api/ws");
  });

  it("IbTwsProvider wsBaseUrl uses wss:// when secure: true", async () => {
    const { IbTwsProvider } = await import("../../../src/providers/ibtws/index.js");
    const p = new IbTwsProvider({ conidMap: { AAPL: 265598 }, secure: true, port: 5001 });
    expect(p.wsBaseUrl).toBe("wss://localhost:5001/v1/api/ws");
  });
});
