# Macro Indicators

`market-feed/macro` fetches macroeconomic time-series data from the [FRED API](https://fred.stlouisfed.org/) (Federal Reserve Bank of St. Louis). A free API key is required — [register here](https://fred.stlouisfed.org/docs/api/api_key.html).

## Basic usage

```ts
import { FredProvider, getIndicator, INDICATORS } from "market-feed/macro";

const fred = new FredProvider({ apiKey: process.env.FRED_KEY! });

// Last 12 months of Consumer Price Index data
const cpi = await getIndicator(fred, INDICATORS.CPI, { limit: 12 });

console.log(`${cpi.name}`);
// Consumer Price Index for All Urban Consumers: All Items in U.S. City Average

for (const obs of cpi.observations) {
  const month = obs.date.toISOString().slice(0, 7);
  console.log(`${month}: ${obs.value}`);
}
```

## `INDICATORS` constants

Named constants for the most commonly used FRED series:

| Constant | Series ID | Description |
|----------|-----------|-------------|
| `INDICATORS.CPI` | `CPIAUCSL` | Consumer Price Index (All Urban) |
| `INDICATORS.FED_FUNDS` | `FEDFUNDS` | Federal Funds Effective Rate |
| `INDICATORS.UNEMPLOYMENT` | `UNRATE` | US Unemployment Rate |
| `INDICATORS.GDP` | `GDPC1` | Real GDP (seasonally adjusted annual rate) |
| `INDICATORS.M2` | `M2SL` | M2 Money Stock |
| `INDICATORS.T10Y` | `DGS10` | 10-Year Treasury Rate |
| `INDICATORS.T2Y` | `DGS2` | 2-Year Treasury Rate |
| `INDICATORS.MORTGAGE_30Y` | `MORTGAGE30US` | 30-Year Fixed Mortgage Average |
| `INDICATORS.PCE` | `PCEPI` | PCE Price Index (Fed's preferred inflation gauge) |
| `INDICATORS.PPI` | `PPIACO` | Producer Price Index — All Commodities |
| `INDICATORS.INDUSTRIAL_PRODUCTION` | `INDPRO` | Industrial Production Index |
| `INDICATORS.RETAIL_SALES` | `RSXFS` | Retail Sales |
| `INDICATORS.OIL_WTI` | `DCOILWTICO` | WTI Crude Oil Price |
| `INDICATORS.HOUSING_STARTS` | `HOUST` | US Housing Starts |
| `INDICATORS.CONSUMER_SENTIMENT` | `UMCSENT` | University of Michigan Consumer Sentiment |

You can also pass any valid FRED series ID string directly:

```ts
const vix = await getIndicator(fred, "VIXCLS"); // CBOE VIX
const credit = await getIndicator(fred, "BAMLH0A0HYM2"); // High-yield credit spread
```

## Date range

```ts
const fedFunds = await getIndicator(fred, INDICATORS.FED_FUNDS, {
  from: "2022-01-01",
  to:   "2024-12-31",
});
```

## `MacroOptions`

```ts
interface MacroOptions {
  /** Start date (YYYY-MM-DD). Default: one year ago */
  from?: string;
  /** End date (YYYY-MM-DD). Default: today */
  to?: string;
  /**
   * Max observations to return (most recent N, then sorted oldest-first).
   * Default: all observations in the date range.
   */
  limit?: number;
}
```

## `MacroSeries`

```ts
interface MacroSeries {
  /** FRED series ID, e.g. "CPIAUCSL" */
  seriesId: string;
  /** Human-readable title from FRED */
  name: string;
  /** Unit description, e.g. "Index 1982-1984=100" */
  units: string;
  /** Observation frequency, e.g. "Monthly", "Quarterly" */
  frequency: string;
  /** Observations sorted oldest-first */
  observations: MacroObservation[];
  provider: "fred";
}

interface MacroObservation {
  date: Date;
  value: number;
}
```

::: info
FRED uses `"."` to represent missing values (e.g. before a series began). These are filtered out automatically and will not appear in `observations`.
:::

## `FredProvider`

```ts
const fred = new FredProvider({
  apiKey: "your-fred-key",
  timeoutMs: 10_000,  // optional, default 10s
  retries: 2,         // optional, default 2
});
```

### Direct method

```ts
// Equivalent to getIndicator(fred, "FEDFUNDS", { limit: 24 })
const series = await fred.getSeries("FEDFUNDS", { limit: 24 });
```

## Common patterns

### Yield curve spread (10Y - 2Y)

```ts
const [t10, t2] = await Promise.all([
  getIndicator(fred, INDICATORS.T10Y, { limit: 24 }),
  getIndicator(fred, INDICATORS.T2Y, { limit: 24 }),
]);

// Align by date and compute spread
const t10Map = new Map(t10.observations.map((o) => [o.date.toISOString(), o.value]));
for (const obs of t2.observations) {
  const t10Val = t10Map.get(obs.date.toISOString());
  if (t10Val !== undefined) {
    console.log(`${obs.date.toISOString().slice(0, 7)}: ${(t10Val - obs.value).toFixed(2)}%`);
  }
}
```

### Inflation trend

```ts
const cpi = await getIndicator(fred, INDICATORS.CPI, { limit: 13 });

// Month-over-month % change
for (let i = 1; i < cpi.observations.length; i++) {
  const prev = cpi.observations[i - 1]!.value;
  const curr = cpi.observations[i]!.value;
  const mom = ((curr - prev) / prev) * 100;
  console.log(`${cpi.observations[i]!.date.toISOString().slice(0, 7)}: ${mom.toFixed(2)}%`);
}
```

### Combine with price data

```ts
import { MarketFeed } from "market-feed";
import { FredProvider, getIndicator, INDICATORS } from "market-feed/macro";

const feed = new MarketFeed();
const fred = new FredProvider({ apiKey: process.env.FRED_KEY! });

const [spyQuote, fedFunds] = await Promise.all([
  feed.quote("SPY"),
  getIndicator(fred, INDICATORS.FED_FUNDS, { limit: 1 }),
]);

const rate = fedFunds.observations.at(-1)!.value;
console.log(`SPY: $${spyQuote.price.toFixed(2)} | Fed Funds: ${rate}%`);
```
