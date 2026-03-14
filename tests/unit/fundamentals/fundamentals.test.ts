import { describe, expect, it, vi } from "vitest";
import { ProviderError } from "../../../src/errors.js";
import { getFundamentals } from "../../../src/fundamentals/index.js";
import { YahooProvider } from "../../../src/providers/yahoo/index.js";
import fundamentalsFixture from "../../fixtures/yahoo-fundamentals.json";

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
// YahooProvider — income statements
// ---------------------------------------------------------------------------

describe("YahooProvider.incomeStatements()", () => {
  it("returns annual income statements from fixture", async () => {
    mockFetch(fundamentalsFixture);
    const provider = new YahooProvider();
    const statements = await provider.incomeStatements("AAPL");

    expect(statements).toHaveLength(2);
    const s = statements[0]!;
    expect(s.symbol).toBe("AAPL");
    expect(s.periodType).toBe("annual");
    expect(s.date).toBeInstanceOf(Date);
    expect(s.date.getFullYear()).toBe(2023);
    expect(s.revenue).toBe(89498000000);
    expect(s.costOfRevenue).toBe(47936000000);
    expect(s.grossProfit).toBe(41562000000);
    expect(s.researchAndDevelopment).toBe(7321000000);
    expect(s.operatingIncome).toBe(27718000000);
    expect(s.netIncome).toBe(22956000000);
    expect(s.ebit).toBe(27906000000);
    expect(s.dilutedEps).toBeCloseTo(1.46, 2);
    expect(s.provider).toBe("yahoo");
    vi.unstubAllGlobals();
  });

  it("respects limit option", async () => {
    mockFetch(fundamentalsFixture);
    const provider = new YahooProvider();
    const statements = await provider.incomeStatements("AAPL", { limit: 1 });
    expect(statements).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  it("returns quarterly statements when quarterly:true", async () => {
    // quarterly module uses incomeStatementHistoryQuarterly — same fixture shape
    const quarterlyFixture = {
      quoteSummary: {
        result: [
          {
            incomeStatementHistoryQuarterly: {
              incomeStatementHistory:
                fundamentalsFixture.quoteSummary.result[0]?.incomeStatementHistory
                  ?.incomeStatementHistory,
            },
          },
        ],
        error: null,
      },
    };
    mockFetch(quarterlyFixture);
    const provider = new YahooProvider();
    const statements = await provider.incomeStatements("AAPL", { quarterly: true });
    expect(statements[0]?.periodType).toBe("quarterly");
    vi.unstubAllGlobals();
  });

  it("includes raw when raw:true", async () => {
    mockFetch(fundamentalsFixture);
    const provider = new YahooProvider();
    const statements = await provider.incomeStatements("AAPL", { raw: true });
    expect(statements[0]?.raw).toBeDefined();
    vi.unstubAllGlobals();
  });

  it("throws ProviderError on null result", async () => {
    mockFetch({
      quoteSummary: { result: null, error: { code: "Not Found", description: "Not found" } },
    });
    const provider = new YahooProvider();
    await expect(provider.incomeStatements("INVALID")).rejects.toThrow(ProviderError);
    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// YahooProvider — balance sheets
// ---------------------------------------------------------------------------

describe("YahooProvider.balanceSheets()", () => {
  it("returns balance sheet with all fields", async () => {
    mockFetch(fundamentalsFixture);
    const provider = new YahooProvider();
    const sheets = await provider.balanceSheets("AAPL");

    expect(sheets).toHaveLength(1);
    const s = sheets[0]!;
    expect(s.symbol).toBe("AAPL");
    expect(s.periodType).toBe("annual");
    expect(s.totalAssets).toBe(352583000000);
    expect(s.totalLiabilities).toBe(290437000000);
    expect(s.totalStockholdersEquity).toBe(62146000000);
    expect(s.cashAndCashEquivalents).toBe(29965000000);
    expect(s.inventory).toBe(6331000000);
    expect(s.longTermDebt).toBe(95281000000);
    expect(s.totalDebt).toBe(111088000000);
    expect(s.provider).toBe("yahoo");
    vi.unstubAllGlobals();
  });

  it("throws ProviderError on null result", async () => {
    mockFetch({
      quoteSummary: { result: null, error: { code: "Not Found", description: "Not found" } },
    });
    const provider = new YahooProvider();
    await expect(provider.balanceSheets("INVALID")).rejects.toThrow(ProviderError);
    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// YahooProvider — cash flows
// ---------------------------------------------------------------------------

describe("YahooProvider.cashFlows()", () => {
  it("returns cash flow statement with all fields", async () => {
    mockFetch(fundamentalsFixture);
    const provider = new YahooProvider();
    const flows = await provider.cashFlows("AAPL");

    expect(flows).toHaveLength(1);
    const s = flows[0]!;
    expect(s.symbol).toBe("AAPL");
    expect(s.periodType).toBe("annual");
    expect(s.operatingCashFlow).toBe(114301000000);
    expect(s.investingCashFlow).toBe(3705000000);
    expect(s.financingCashFlow).toBe(-108488000000);
    expect(s.capitalExpenditures).toBe(-10959000000);
    expect(s.depreciation).toBe(11519000000);
    // freeCashFlow = operatingCF + capex = 114301000000 + (-10959000000) = 103342000000
    expect(s.freeCashFlow).toBe(103342000000);
    expect(s.provider).toBe("yahoo");
    vi.unstubAllGlobals();
  });

  it("throws ProviderError on null result", async () => {
    mockFetch({
      quoteSummary: { result: null, error: { code: "Not Found", description: "Not found" } },
    });
    const provider = new YahooProvider();
    await expect(provider.cashFlows("INVALID")).rejects.toThrow(ProviderError);
    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// getFundamentals() convenience function
// ---------------------------------------------------------------------------

describe("getFundamentals()", () => {
  it("returns all three statements at once", async () => {
    mockFetch(fundamentalsFixture);
    const provider = new YahooProvider();
    const result = await getFundamentals(provider, "AAPL");

    expect(result.symbol).toBe("AAPL");
    expect(result.incomeStatements.length).toBeGreaterThan(0);
    expect(result.balanceSheets.length).toBeGreaterThan(0);
    expect(result.cashFlows.length).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });

  it("returns empty arrays for statements that fail", async () => {
    // source without any fundamentals methods
    const emptySource = {};
    const result = await getFundamentals(emptySource, "AAPL");

    expect(result.symbol).toBe("AAPL");
    expect(result.incomeStatements).toEqual([]);
    expect(result.balanceSheets).toEqual([]);
    expect(result.cashFlows).toEqual([]);
  });

  it("uppercases the symbol in the result", async () => {
    const result = await getFundamentals({}, "aapl");
    expect(result.symbol).toBe("AAPL");
  });

  it("partial failure — missing statement still returns others", async () => {
    let _callCount = 0;
    const partialSource = {
      incomeStatements: async () => {
        _callCount++;
        return [
          { symbol: "AAPL", date: new Date(), periodType: "annual" as const, provider: "test" },
        ];
      },
      balanceSheets: async (): Promise<never> => {
        throw new Error("no balance sheet");
      },
      cashFlows: async () => {
        _callCount++;
        return [
          { symbol: "AAPL", date: new Date(), periodType: "annual" as const, provider: "test" },
        ];
      },
    };

    const result = await getFundamentals(partialSource, "AAPL");
    expect(result.incomeStatements).toHaveLength(1);
    expect(result.balanceSheets).toEqual([]); // failed → empty
    expect(result.cashFlows).toHaveLength(1);
  });
});
