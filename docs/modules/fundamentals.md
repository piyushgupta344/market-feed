# Fundamentals

`market-feed/fundamentals` fetches income statements, balance sheets, and cash flow statements for public companies.

## Basic usage

```ts
import { getFundamentals } from "market-feed/fundamentals";
import { MarketFeed } from "market-feed";

const feed = new MarketFeed();

const { incomeStatements, balanceSheets, cashFlows } = await getFundamentals(feed, "AAPL");

const latest = incomeStatements[0]!;
console.log(`Revenue:      $${(latest.revenue! / 1e9).toFixed(1)}B`);
console.log(`Gross profit: $${(latest.grossProfit! / 1e9).toFixed(1)}B`);
console.log(`Net income:   $${(latest.netIncome! / 1e9).toFixed(1)}B`);
console.log(`EPS (diluted): $${latest.dilutedEps?.toFixed(2)}`);
```

## Quarterly statements

```ts
const { incomeStatements } = await getFundamentals(feed, "AAPL", {
  quarterly: true,
  limit: 4,           // last 4 quarters
});

for (const stmt of incomeStatements) {
  console.log(`${stmt.date.toDateString()}: revenue $${(stmt.revenue! / 1e9).toFixed(1)}B`);
}
```

## Direct methods on `MarketFeed`

For finer control, call each statement type individually:

```ts
const annual = await feed.incomeStatements("AAPL");
const quarterly = await feed.incomeStatements("AAPL", { quarterly: true, limit: 4 });

const bs = await feed.balanceSheets("AAPL");
const cf = await feed.cashFlows("AAPL");
```

## `getFundamentals()` vs direct methods

`getFundamentals()` fires all three queries in parallel via `Promise.allSettled`. If one statement type fails (e.g. the provider doesn't support cash flows), the others are still returned. Failed types resolve to an empty array.

```ts
const result = await getFundamentals(feed, "AAPL");
// Even if cashFlows throws, result.incomeStatements and result.balanceSheets are populated
```

## `IncomeStatement`

```ts
interface IncomeStatement {
  symbol: string;
  date: Date;                     // period end date
  periodType: "annual" | "quarterly";
  revenue?: number;
  costOfRevenue?: number;
  grossProfit?: number;
  operatingExpenses?: number;
  operatingIncome?: number;       // EBIT (operating)
  ebit?: number;
  ebitda?: number;
  netIncome?: number;
  dilutedEps?: number;
  provider: string;
  raw?: unknown;
}
```

## `BalanceSheet`

```ts
interface BalanceSheet {
  symbol: string;
  date: Date;
  periodType: "annual" | "quarterly";
  totalAssets?: number;
  totalLiabilities?: number;
  totalStockholdersEquity?: number;
  cashAndCashEquivalents?: number;
  shortTermInvestments?: number;
  totalCurrentAssets?: number;
  totalCurrentLiabilities?: number;
  totalDebt?: number;
  longTermDebt?: number;
  retainedEarnings?: number;
  provider: string;
  raw?: unknown;
}
```

## `CashFlowStatement`

```ts
interface CashFlowStatement {
  symbol: string;
  date: Date;
  periodType: "annual" | "quarterly";
  operatingCashFlow?: number;
  capitalExpenditures?: number;    // negative = outflow
  freeCashFlow?: number;           // operatingCashFlow + capitalExpenditures
  investingCashFlow?: number;
  financingCashFlow?: number;
  dividendsPaid?: number;
  stockRepurchases?: number;
  provider: string;
  raw?: unknown;
}
```

::: tip Free cash flow
`freeCashFlow = operatingCashFlow + capitalExpenditures`

Yahoo reports CapEx as a negative number, so addition gives the correct result:
`$114B + (-$11B) = $103B FCF`
:::

### Using Polygon directly

```ts
import { PolygonProvider } from "market-feed";

const polygon = new PolygonProvider({ apiKey: process.env.POLYGON_KEY! });

const stmts = await polygon.incomeStatements("AAPL", { quarterly: true, limit: 4 });
```

### Using Tiingo directly

```ts
import { TiingoProvider } from "market-feed";

const tiingo = new TiingoProvider({ apiKey: process.env.TIINGO_KEY! });

const sheets = await tiingo.balanceSheets("AAPL");
```

## `FundamentalsOptions`

```ts
interface FundamentalsOptions {
  quarterly?: boolean;  // Default: false (annual)
  limit?: number;       // max periods to return
  raw?: boolean;        // include raw provider response on each object
}
```

## Provider support

| Provider | Income Statement | Balance Sheet | Cash Flow |
|----------|:---:|:---:|:---:|
| Yahoo Finance | ✓ | ✓ | ✓ |
| Polygon.io | ✓ | ✓ | ✓ |
| Tiingo | ✓ | ✓ | ✓ |
| Alpha Vantage | — | — | — |
| Finnhub | — | — | — |
| Twelve Data | — | — | — |

**Yahoo Finance** uses the `quoteSummary` API — provides annual and quarterly data for most publicly traded US equities.

**Polygon.io** uses the `/vX/reference/financials` endpoint — provides XBRL-sourced financial data filed with the SEC. Annual and quarterly.

**Tiingo** uses the `/tiingo/fundamentals/{ticker}/statements` endpoint — provides standardized data codes for income statement, balance sheet, and cash flow.

When using `MarketFeed` with multiple providers, `getFundamentals()` tries each in order until one succeeds:
