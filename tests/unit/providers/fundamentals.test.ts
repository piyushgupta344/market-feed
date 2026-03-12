import { describe, expect, it, vi } from "vitest";
import { PolygonProvider } from "../../../src/providers/polygon/index.js";
import polygonFinancialsFixture from "../../fixtures/polygon-financials.json";

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
// Polygon — incomeStatements
// ---------------------------------------------------------------------------

describe("PolygonProvider.incomeStatements()", () => {
  it("returns normalised IncomeStatement array", async () => {
    mockFetch(polygonFinancialsFixture);
    const provider = new PolygonProvider({ apiKey: "test-key" });
    const stmts = await provider.incomeStatements("AAPL");

    expect(stmts).toHaveLength(1);
    const s = stmts[0]!;
    expect(s.symbol).toBe("AAPL");
    expect(s.date).toBeInstanceOf(Date);
    expect(s.date.toISOString().startsWith("2024-09-30")).toBe(true);
    expect(s.periodType).toBe("quarterly");
    expect(s.revenue).toBe(94930000000);
    expect(s.costOfRevenue).toBe(50481000000);
    expect(s.grossProfit).toBe(44449000000);
    expect(s.researchAndDevelopment).toBe(7856000000);
    expect(s.operatingIncome).toBe(29550000000);
    expect(s.ebit).toBe(29550000000);
    expect(s.netIncome).toBe(14736000000);
    expect(s.eps).toBe(0.97);
    expect(s.dilutedEps).toBe(0.97);
    expect(s.provider).toBe("polygon");

    vi.unstubAllGlobals();
  });

  it("includes raw when requested", async () => {
    mockFetch(polygonFinancialsFixture);
    const provider = new PolygonProvider({ apiKey: "test-key" });
    const stmts = await provider.incomeStatements("AAPL", { raw: true });
    expect(stmts[0]?.raw).toBeDefined();
    vi.unstubAllGlobals();
  });

  it("throws ProviderError when results is empty", async () => {
    mockFetch({ status: "OK", results: [] });
    const provider = new PolygonProvider({ apiKey: "test-key" });
    await expect(provider.incomeStatements("AAPL")).rejects.toThrow('No financials data for "AAPL"');
    vi.unstubAllGlobals();
  });

  it("throws ProviderError on Polygon error status", async () => {
    mockFetch({ status: "ERROR", error: "Forbidden" });
    const provider = new PolygonProvider({ apiKey: "test-key" });
    await expect(provider.incomeStatements("AAPL")).rejects.toThrow("Forbidden");
    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// Polygon — balanceSheets
// ---------------------------------------------------------------------------

describe("PolygonProvider.balanceSheets()", () => {
  it("returns normalised BalanceSheet array", async () => {
    mockFetch(polygonFinancialsFixture);
    const provider = new PolygonProvider({ apiKey: "test-key" });
    const sheets = await provider.balanceSheets("AAPL");

    expect(sheets).toHaveLength(1);
    const s = sheets[0]!;
    expect(s.symbol).toBe("AAPL");
    expect(s.date).toBeInstanceOf(Date);
    expect(s.periodType).toBe("quarterly");
    expect(s.totalAssets).toBe(364980000000);
    expect(s.totalCurrentAssets).toBe(143566000000);
    expect(s.totalLiabilities).toBe(308030000000);
    expect(s.totalCurrentLiabilities).toBe(176392000000);
    expect(s.totalStockholdersEquity).toBe(56950000000);
    expect(s.cashAndCashEquivalents).toBe(29943000000);
    expect(s.longTermDebt).toBe(97150000000);
    expect(s.retainedEarnings).toBe(-19154000000);
    expect(s.provider).toBe("polygon");

    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// Polygon — cashFlows
// ---------------------------------------------------------------------------

describe("PolygonProvider.cashFlows()", () => {
  it("returns normalised CashFlowStatement array", async () => {
    mockFetch(polygonFinancialsFixture);
    const provider = new PolygonProvider({ apiKey: "test-key" });
    const flows = await provider.cashFlows("AAPL");

    expect(flows).toHaveLength(1);
    const f = flows[0]!;
    expect(f.symbol).toBe("AAPL");
    expect(f.date).toBeInstanceOf(Date);
    expect(f.periodType).toBe("quarterly");
    expect(f.operatingCashFlow).toBe(26808000000);
    expect(f.capitalExpenditures).toBe(-2822000000);
    expect(f.freeCashFlow).toBe(26808000000 + -2822000000);
    expect(f.investingCashFlow).toBe(-2753000000);
    expect(f.financingCashFlow).toBe(-28671000000);
    expect(f.netChangeInCash).toBe(-4616000000);
    expect(f.provider).toBe("polygon");

    vi.unstubAllGlobals();
  });

  it("omits freeCashFlow when capitalExpenditures is missing", async () => {
    const fixture = structuredClone(polygonFinancialsFixture);
    delete (fixture.results[0]!.financials.cash_flow_statement as Record<string, unknown>)[
      "capital_expenditure"
    ];
    mockFetch(fixture);
    const provider = new PolygonProvider({ apiKey: "test-key" });
    const flows = await provider.cashFlows("AAPL");
    expect(flows[0]?.capitalExpenditures).toBeUndefined();
    expect(flows[0]?.freeCashFlow).toBeUndefined();
    vi.unstubAllGlobals();
  });
});
