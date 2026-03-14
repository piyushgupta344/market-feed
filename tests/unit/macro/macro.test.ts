import { describe, expect, it, vi } from "vitest";
import { FredProvider, INDICATORS, getIndicator } from "../../../src/macro/index.js";
import fredObsFixture from "../../fixtures/fred-observations.json";
import fredSeriesFixture from "../../fixtures/fred-series.json";

// FRED requires two calls: /fred/series and /fred/series/observations
// We mock fetch to alternate between them in order.
function mockFredFetch() {
  let callCount = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async () => {
      const fixture = callCount === 0 ? fredSeriesFixture : fredObsFixture;
      callCount++;
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: { get: () => "application/json" },
        json: async () => fixture,
      };
    }),
  );
}

// ---------------------------------------------------------------------------
// FredProvider.getSeries()
// ---------------------------------------------------------------------------

describe("FredProvider.getSeries()", () => {
  it("returns a normalised MacroSeries", async () => {
    mockFredFetch();
    const fred = new FredProvider({ apiKey: "test-key" });
    const series = await fred.getSeries("CPIAUCSL");

    expect(series.seriesId).toBe("CPIAUCSL");
    expect(series.name).toBe(
      "Consumer Price Index for All Urban Consumers: All Items in U.S. City Average",
    );
    expect(series.units).toBe("Index 1982-1984=100");
    expect(series.frequency).toBe("Monthly");
    expect(series.provider).toBe("fred");
    expect(series.observations).toHaveLength(6);
    vi.unstubAllGlobals();
  });

  it("returns observations sorted oldest-first", async () => {
    mockFredFetch();
    const fred = new FredProvider({ apiKey: "test-key" });
    const series = await fred.getSeries("CPIAUCSL");

    for (let i = 1; i < series.observations.length; i++) {
      // biome-ignore lint/style/noNonNullAssertion: bounds-checked by loop condition
      expect(series.observations[i - 1]!.date.getTime()).toBeLessThan(
        series.observations[i]!.date.getTime(),
      );
    }
    vi.unstubAllGlobals();
  });

  it("parses observation date and value correctly", async () => {
    mockFredFetch();
    const fred = new FredProvider({ apiKey: "test-key" });
    const series = await fred.getSeries("CPIAUCSL");

    const first = series.observations[0]!;
    expect(first.date).toBeInstanceOf(Date);
    expect(first.date.getFullYear()).toBe(2024);
    expect(first.value).toBe(308.417);
    vi.unstubAllGlobals();
  });

  it("respects limit option", async () => {
    mockFredFetch();
    const fred = new FredProvider({ apiKey: "test-key" });
    const series = await fred.getSeries("CPIAUCSL", { limit: 3 });

    // limit=3 takes the 3 most recent, then reverses → oldest 3 of the 6
    expect(series.observations).toHaveLength(3);
    vi.unstubAllGlobals();
  });

  it("filters out missing FRED values ('.')", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => {
        const fixture =
          callCount === 0
            ? fredSeriesFixture
            : {
                observations: [
                  { date: "2024-01-01", value: "308.417" },
                  { date: "2024-02-01", value: "." }, // missing
                  { date: "2024-03-01", value: "311.277" },
                ],
              };
        callCount++;
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          headers: { get: () => "application/json" },
          json: async () => fixture,
        };
      }),
    );

    const fred = new FredProvider({ apiKey: "test-key" });
    const series = await fred.getSeries("CPIAUCSL");

    expect(series.observations).toHaveLength(2);
    expect(series.observations.every((o) => !Number.isNaN(o.value))).toBe(true);
    vi.unstubAllGlobals();
  });

  it("throws on FRED error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({
          error_code: 400,
          error_message: "Bad Request. Variable series_id is not defined.",
        }),
      }),
    );
    const fred = new FredProvider({ apiKey: "test-key" });
    await expect(fred.getSeries("BAD_ID")).rejects.toThrow("FRED error:");
    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// getIndicator() helper
// ---------------------------------------------------------------------------

describe("getIndicator()", () => {
  it("delegates to source.getSeries()", async () => {
    const mockSeries = {
      seriesId: "FEDFUNDS",
      name: "Federal Funds Effective Rate",
      units: "Percent",
      frequency: "Monthly",
      observations: [],
      provider: "fred" as const,
    };
    const source = { getSeries: vi.fn().mockResolvedValue(mockSeries) };
    const result = await getIndicator(source, "FEDFUNDS");
    expect(result.seriesId).toBe("FEDFUNDS");
    expect(source.getSeries).toHaveBeenCalledWith("FEDFUNDS", undefined);
  });

  it("works with INDICATORS constants", async () => {
    const source = {
      getSeries: vi.fn().mockResolvedValue({
        seriesId: INDICATORS.CPI,
        name: "CPI",
        units: "Index",
        frequency: "Monthly",
        observations: [],
        provider: "fred" as const,
      }),
    };
    await getIndicator(source, INDICATORS.CPI, { limit: 12 });
    expect(source.getSeries).toHaveBeenCalledWith(INDICATORS.CPI, { limit: 12 });
  });
});

// ---------------------------------------------------------------------------
// INDICATORS constants
// ---------------------------------------------------------------------------

describe("INDICATORS constants", () => {
  it("exports expected series IDs", () => {
    expect(INDICATORS.CPI).toBe("CPIAUCSL");
    expect(INDICATORS.FED_FUNDS).toBe("FEDFUNDS");
    expect(INDICATORS.UNEMPLOYMENT).toBe("UNRATE");
    expect(INDICATORS.GDP).toBe("GDPC1");
    expect(INDICATORS.T10Y).toBe("DGS10");
  });
});
