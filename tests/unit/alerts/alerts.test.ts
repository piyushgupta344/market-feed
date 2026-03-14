import { describe, expect, it, vi } from "vitest";
import { watchAlerts } from "../../../src/alerts/index.js";
import type { AlertConfig, AlertEvent } from "../../../src/alerts/types.js";
import type { Quote } from "../../../src/types/quote.js";

// ---------------------------------------------------------------------------
// Test helpers
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

function makeFeed(quote: Quote | Quote[]) {
  const quotes = Array.isArray(quote) ? quote : [quote];
  return {
    quote: vi.fn().mockResolvedValue(quotes),
  };
}

// ---------------------------------------------------------------------------
// Empty alerts
// ---------------------------------------------------------------------------

describe("watchAlerts() — empty alerts", () => {
  it("returns done immediately", async () => {
    const gen = watchAlerts(makeFeed(makeQuote()), []);
    const result = await gen.next();
    expect(result.done).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Condition: price_above
// ---------------------------------------------------------------------------

describe("watchAlerts() — price_above", () => {
  it("fires when price exceeds threshold", async () => {
    const alert: AlertConfig = {
      symbol: "AAPL",
      condition: { type: "price_above", threshold: 185 },
      once: true,
    };
    const feed = makeFeed(makeQuote({ price: 190 }));

    const gen = watchAlerts(feed, [alert], { intervalMs: 100 });
    const { value } = (await gen.next()) as { value: AlertEvent; done: false };

    expect(value.type).toBe("triggered");
    expect(value.alert).toBe(alert);
    expect(value.quote.price).toBe(190);
    expect(value.triggeredAt).toBeInstanceOf(Date);
  });

  it("does NOT fire when price is below threshold", async () => {
    const alert: AlertConfig = {
      symbol: "AAPL",
      condition: { type: "price_above", threshold: 200 },
      once: true,
    };
    const controller = new AbortController();
    const feed = makeFeed(makeQuote({ price: 190 }));

    const gen = watchAlerts(feed, [alert], { intervalMs: 50, signal: controller.signal });

    // Abort before it could fire
    const p = gen.next();
    controller.abort();
    const result = await p;
    expect(result.done).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Condition: price_below
// ---------------------------------------------------------------------------

describe("watchAlerts() — price_below", () => {
  it("fires when price drops below threshold", async () => {
    const alert: AlertConfig = {
      symbol: "AAPL",
      condition: { type: "price_below", threshold: 195 },
      once: true,
    };
    const feed = makeFeed(makeQuote({ price: 190 }));

    const gen = watchAlerts(feed, [alert], { intervalMs: 100 });
    const { value } = (await gen.next()) as { value: AlertEvent };

    expect(value.type).toBe("triggered");
    expect(value.quote.price).toBe(190);
  });
});

// ---------------------------------------------------------------------------
// Condition: change_pct_above / change_pct_below
// ---------------------------------------------------------------------------

describe("watchAlerts() — change_pct conditions", () => {
  it("fires change_pct_above when daily change exceeds threshold", async () => {
    const alert: AlertConfig = {
      symbol: "AAPL",
      condition: { type: "change_pct_above", threshold: 1 },
      once: true,
    };
    const feed = makeFeed(makeQuote({ changePercent: 1.5 }));

    const gen = watchAlerts(feed, [alert], { intervalMs: 100 });
    const { value } = (await gen.next()) as { value: AlertEvent };

    expect(value.type).toBe("triggered");
  });

  it("fires change_pct_below when change is below negative threshold", async () => {
    const alert: AlertConfig = {
      symbol: "AAPL",
      condition: { type: "change_pct_below", threshold: -1 },
      once: true,
    };
    const feed = makeFeed(makeQuote({ changePercent: -2 }));

    const gen = watchAlerts(feed, [alert], { intervalMs: 100 });
    const { value } = (await gen.next()) as { value: AlertEvent };

    expect(value.type).toBe("triggered");
  });
});

// ---------------------------------------------------------------------------
// Condition: volume_above
// ---------------------------------------------------------------------------

describe("watchAlerts() — volume_above", () => {
  it("fires when volume exceeds threshold", async () => {
    const alert: AlertConfig = {
      symbol: "AAPL",
      condition: { type: "volume_above", threshold: 40_000_000 },
      once: true,
    };
    const feed = makeFeed(makeQuote({ volume: 50_000_000 }));

    const gen = watchAlerts(feed, [alert], { intervalMs: 100 });
    const { value } = (await gen.next()) as { value: AlertEvent };

    expect(value.type).toBe("triggered");
  });
});

// ---------------------------------------------------------------------------
// once flag
// ---------------------------------------------------------------------------

describe("watchAlerts() — once flag", () => {
  it("terminates after once alert fires", async () => {
    const alert: AlertConfig = {
      symbol: "AAPL",
      condition: { type: "price_above", threshold: 185 },
      once: true,
    };
    const feed = makeFeed(makeQuote({ price: 190 }));

    const events: AlertEvent[] = [];
    for await (const event of watchAlerts(feed, [alert], { intervalMs: 100 })) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
  });

  it("keeps firing when once is false until aborted", async () => {
    let callCount = 0;
    const alert: AlertConfig = {
      symbol: "AAPL",
      condition: { type: "price_above", threshold: 185 },
      once: false,
    };
    const controller = new AbortController();
    const feed = {
      quote: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount >= 3) controller.abort();
        return Promise.resolve([makeQuote({ price: 190 })]);
      }),
    };

    const events: AlertEvent[] = [];
    for await (const event of watchAlerts(feed, [alert], {
      intervalMs: 0,
      signal: controller.signal,
    })) {
      events.push(event);
    }

    expect(events.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// debounce
// ---------------------------------------------------------------------------

describe("watchAlerts() — debounce", () => {
  it("suppresses re-fire within debounceMs window", async () => {
    const alert: AlertConfig = {
      symbol: "AAPL",
      condition: { type: "price_above", threshold: 185 },
      once: false,
      debounceMs: 60_000,
    };
    const controller = new AbortController();
    let pollCount = 0;
    const feed = {
      quote: vi.fn().mockImplementation(() => {
        pollCount++;
        if (pollCount >= 3) controller.abort();
        return Promise.resolve([makeQuote({ price: 190 })]);
      }),
    };

    const events: AlertEvent[] = [];
    for await (const event of watchAlerts(feed, [alert], {
      intervalMs: 0,
      signal: controller.signal,
    })) {
      events.push(event);
    }

    // Should only fire once because all 3 polls happen within the same millisecond,
    // well within the 60 000 ms debounce window
    expect(events).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// AbortSignal
// ---------------------------------------------------------------------------

describe("watchAlerts() — AbortSignal", () => {
  it("stops cleanly when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const alert: AlertConfig = {
      symbol: "AAPL",
      condition: { type: "price_above", threshold: 185 },
    };

    const gen = watchAlerts(makeFeed(makeQuote({ price: 190 })), [alert], {
      signal: controller.signal,
    });
    const result = await gen.next();
    expect(result.done).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Error recovery
// ---------------------------------------------------------------------------

describe("watchAlerts() — error recovery", () => {
  it("continues polling after a transient fetch error", async () => {
    let callCount = 0;
    const controller = new AbortController();
    const feed = {
      quote: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.reject(new Error("network error"));
        controller.abort();
        return Promise.resolve([makeQuote({ price: 190 })]);
      }),
    };

    const alert: AlertConfig = {
      symbol: "AAPL",
      condition: { type: "price_above", threshold: 185 },
      once: true,
    };

    const events: AlertEvent[] = [];
    for await (const event of watchAlerts(feed, [alert], {
      intervalMs: 0,
      signal: controller.signal,
    })) {
      events.push(event);
    }

    // Should have recovered and fired on second poll
    // (signal was aborted after second poll — event may or may not have fired)
    expect(callCount).toBeGreaterThanOrEqual(2);
  });
});
