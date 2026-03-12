import { describe, expect, it, vi } from "vitest";
import { getOptionChain } from "../../../src/options/index.js";
import { PolygonProvider } from "../../../src/providers/polygon/index.js";
import polygonOptionsFixture from "../../fixtures/polygon-options.json";

function mockFetch(fixture: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status,
      statusText: ok ? "OK" : "Error",
      headers: { get: () => "application/json" },
      json: async () => fixture,
    }),
  );
}

// ---------------------------------------------------------------------------
// PolygonProvider.optionChain()
// ---------------------------------------------------------------------------

describe("PolygonProvider.optionChain()", () => {
  it("returns a chain with calls and puts", async () => {
    mockFetch(polygonOptionsFixture);
    const provider = new PolygonProvider({ apiKey: "test-key" });
    const chain = await provider.optionChain("AAPL");

    expect(chain.underlyingSymbol).toBe("AAPL");
    expect(chain.calls).toHaveLength(1);
    expect(chain.puts).toHaveLength(1);
    expect(chain.fetchedAt).toBeInstanceOf(Date);
    vi.unstubAllGlobals();
  });

  it("maps call contract fields correctly", async () => {
    mockFetch(polygonOptionsFixture);
    const provider = new PolygonProvider({ apiKey: "test-key" });
    const chain = await provider.optionChain("AAPL");
    const call = chain.calls[0]!;

    expect(call.ticker).toBe("O:AAPL240719C00150000");
    expect(call.underlyingSymbol).toBe("AAPL");
    expect(call.type).toBe("call");
    expect(call.strike).toBe(150);
    expect(call.expiry).toBeInstanceOf(Date);
    expect(call.expiry.toISOString().startsWith("2024-07-19")).toBe(true);
    expect(call.style).toBe("american");
    expect(call.sharesPerContract).toBe(100);
    expect(call.bid).toBe(24.45);
    expect(call.ask).toBe(24.95);
    expect(call.midpoint).toBe(24.7);
    expect(call.lastPrice).toBe(24.12);
    expect(call.volume).toBe(1157);
    expect(call.openInterest).toBe(91);
    expect(call.impliedVolatility).toBe(0.5196);
    expect(call.delta).toBe(0.8535);
    expect(call.gamma).toBe(0.019);
    expect(call.theta).toBe(-0.0143);
    expect(call.vega).toBe(0.2024);
    expect(call.open).toBe(24.86);
    expect(call.close).toBe(24.07);
    expect(call.provider).toBe("polygon");
    vi.unstubAllGlobals();
  });

  it("maps put contract fields correctly", async () => {
    mockFetch(polygonOptionsFixture);
    const provider = new PolygonProvider({ apiKey: "test-key" });
    const chain = await provider.optionChain("AAPL");
    const put = chain.puts[0]!;

    expect(put.type).toBe("put");
    expect(put.delta).toBe(-0.1465);
    expect(put.openInterest).toBe(432);
    vi.unstubAllGlobals();
  });

  it("returns empty chain when no results", async () => {
    mockFetch({ status: "OK", results: [] });
    const provider = new PolygonProvider({ apiKey: "test-key" });
    const chain = await provider.optionChain("AAPL");
    expect(chain.calls).toHaveLength(0);
    expect(chain.puts).toHaveLength(0);
    vi.unstubAllGlobals();
  });

  it("includes raw when requested", async () => {
    mockFetch(polygonOptionsFixture);
    const provider = new PolygonProvider({ apiKey: "test-key" });
    const chain = await provider.optionChain("AAPL", { raw: true });
    expect(chain.calls[0]?.raw).toBeDefined();
    vi.unstubAllGlobals();
  });

  it("throws ProviderError on Polygon error", async () => {
    mockFetch({ status: "ERROR", error: "Not authorized" });
    const provider = new PolygonProvider({ apiKey: "bad-key" });
    await expect(provider.optionChain("AAPL")).rejects.toThrow("Not authorized");
    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// getOptionChain() helper
// ---------------------------------------------------------------------------

describe("getOptionChain()", () => {
  it("delegates to source.optionChain()", async () => {
    mockFetch(polygonOptionsFixture);
    const polygon = new PolygonProvider({ apiKey: "test-key" });
    const chain = await getOptionChain(polygon, "AAPL", { expiry: "2024-07-19" });

    expect(chain.calls).toHaveLength(1);
    expect(chain.puts).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  it("accepts any duck-typed source with optionChain()", async () => {
    const mockChain = {
      underlyingSymbol: "TSLA",
      calls: [],
      puts: [],
      fetchedAt: new Date(),
    };
    const source = { optionChain: vi.fn().mockResolvedValue(mockChain) };
    const result = await getOptionChain(source, "TSLA");
    expect(result.underlyingSymbol).toBe("TSLA");
    expect(source.optionChain).toHaveBeenCalledWith("TSLA", undefined);
  });
});
