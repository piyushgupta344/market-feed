/**
 * market-feed/macro
 *
 * Fetches macroeconomic time-series data from the FRED API (Federal Reserve Bank of St. Louis).
 * A free API key is required — register at https://fred.stlouisfed.org/docs/api/api_key.html
 *
 * @example
 * ```ts
 * import { FredProvider, getIndicator, INDICATORS } from "market-feed/macro";
 *
 * const fred = new FredProvider({ apiKey: process.env.FRED_KEY! });
 *
 * // Fetch the last 12 months of CPI data
 * const cpi = await getIndicator(fred, "CPIAUCSL", { limit: 12 });
 * console.log(cpi.name); // "Consumer Price Index for All Urban Consumers: All Items in U.S. City Average"
 * for (const obs of cpi.observations) {
 *   console.log(`${obs.date.toISOString().slice(0, 7)}: ${obs.value}`);
 * }
 * ```
 */

import { HttpClient } from "../http/client.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MacroObservation {
  date: Date;
  value: number;
}

export interface MacroSeries {
  /** FRED series ID, e.g. "CPIAUCSL" */
  seriesId: string;
  /** Human-readable series name from FRED */
  name: string;
  /** Unit description, e.g. "Index 1982-1984=100" */
  units: string;
  /** Observation frequency, e.g. "Monthly", "Quarterly", "Annual" */
  frequency: string;
  /** Observations sorted oldest-first */
  observations: MacroObservation[];
  provider: "fred";
}

export interface MacroOptions {
  /**
   * Start date for the series (YYYY-MM-DD).
   * Defaults to one year ago.
   */
  from?: string;
  /**
   * End date for the series (YYYY-MM-DD).
   * Defaults to today.
   */
  to?: string;
  /**
   * Max number of observations to return (most recent first after fetch).
   * Default: all observations in the date range.
   */
  limit?: number;
}

export interface FredProviderOptions {
  apiKey: string;
  /** Request timeout in milliseconds. Defaults to 10 000. */
  timeoutMs?: number;
  /** Retry attempts on transient failures. Defaults to 2. */
  retries?: number;
}

// ---------------------------------------------------------------------------
// Well-known FRED series IDs
// ---------------------------------------------------------------------------

/** Commonly used FRED series IDs as named constants. */
export const INDICATORS = {
  /** Consumer Price Index for All Urban Consumers — All Items */
  CPI: "CPIAUCSL",
  /** Federal Funds Effective Rate */
  FED_FUNDS: "FEDFUNDS",
  /** US Unemployment Rate */
  UNEMPLOYMENT: "UNRATE",
  /** US Real GDP (seasonally adjusted annual rate) */
  GDP: "GDPC1",
  /** US M2 Money Stock */
  M2: "M2SL",
  /** 10-Year Treasury Constant Maturity Rate */
  T10Y: "DGS10",
  /** 2-Year Treasury Constant Maturity Rate */
  T2Y: "DGS2",
  /** 30-Year Fixed Rate Mortgage Average */
  MORTGAGE_30Y: "MORTGAGE30US",
  /** US Personal Consumption Expenditures Price Index */
  PCE: "PCEPI",
  /** Producer Price Index — All Commodities */
  PPI: "PPIACO",
  /** US Industrial Production Index */
  INDUSTRIAL_PRODUCTION: "INDPRO",
  /** US Retail Sales */
  RETAIL_SALES: "RSXFS",
  /** WTI Crude Oil Price */
  OIL_WTI: "DCOILWTICO",
  /** US Housing Starts */
  HOUSING_STARTS: "HOUST",
  /** University of Michigan Consumer Sentiment */
  CONSUMER_SENTIMENT: "UMCSENT",
} as const;

export type IndicatorId = (typeof INDICATORS)[keyof typeof INDICATORS] | string;

// ---------------------------------------------------------------------------
// FRED API raw response types
// ---------------------------------------------------------------------------

interface FredSeriesResponse {
  seriess?: FredSeries[];
  error_code?: number;
  error_message?: string;
}

interface FredSeries {
  id: string;
  title: string;
  units: string;
  frequency: string;
  observation_start: string;
  observation_end: string;
}

interface FredObservationsResponse {
  observations?: FredObservation[];
  error_code?: number;
  error_message?: string;
}

interface FredObservation {
  date: string;
  value: string;
}

// ---------------------------------------------------------------------------
// FredProvider
// ---------------------------------------------------------------------------

/**
 * FRED provider for macroeconomic time-series data.
 *
 * @example
 * ```ts
 * const fred = new FredProvider({ apiKey: process.env.FRED_KEY! });
 * const cpi = await fred.getSeries("CPIAUCSL", { limit: 24 });
 * ```
 */
export class FredProvider {
  readonly name = "fred";

  private readonly http: HttpClient;
  private readonly apiKey: string;

  constructor(options: FredProviderOptions) {
    this.apiKey = options.apiKey;
    this.http = new HttpClient("fred", {
      baseUrl: "https://api.stlouisfed.org",
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
      ...(options.retries !== undefined ? { retries: options.retries } : {}),
    });
  }

  async getSeries(seriesId: string, options?: MacroOptions): Promise<MacroSeries> {
    const today = new Date().toISOString().slice(0, 10);
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const from = options?.from ?? oneYearAgo;
    const to = options?.to ?? today;

    // Fetch series metadata and observations in parallel
    const [metaData, obsData] = await Promise.all([
      this.http.get<FredSeriesResponse>("/fred/series", {
        params: {
          series_id: seriesId,
          api_key: this.apiKey,
          file_type: "json",
        },
      }),
      this.http.get<FredObservationsResponse>("/fred/series/observations", {
        params: {
          series_id: seriesId,
          api_key: this.apiKey,
          file_type: "json",
          observation_start: from,
          observation_end: to,
          sort_order: "desc",
        },
      }),
    ]);

    if (metaData.error_message) {
      throw new Error(`FRED error: ${metaData.error_message}`);
    }
    if (obsData.error_message) {
      throw new Error(`FRED error: ${obsData.error_message}`);
    }

    const meta = metaData.seriess?.[0];
    if (!meta) {
      throw new Error(`No FRED series found for "${seriesId}"`);
    }

    // Filter out missing values (FRED uses "." for missing data)
    let observations: MacroObservation[] = (obsData.observations ?? [])
      .filter((o) => o.value !== ".")
      .map((o) => ({
        date: new Date(o.date),
        value: Number(o.value),
      }));

    // Apply limit (data already sorted desc — take first N, then reverse to oldest-first)
    if (options?.limit !== undefined) {
      observations = observations.slice(0, options.limit);
    }
    observations.reverse();

    return {
      seriesId,
      name: meta.title,
      units: meta.units,
      frequency: meta.frequency,
      observations,
      provider: "fred",
    };
  }
}

// ---------------------------------------------------------------------------
// Duck-typed source for getIndicator()
// ---------------------------------------------------------------------------

interface MacroSource {
  getSeries(seriesId: string, options?: MacroOptions): Promise<MacroSeries>;
}

// ---------------------------------------------------------------------------
// Public helper
// ---------------------------------------------------------------------------

/**
 * Fetch a macroeconomic time-series by FRED series ID.
 *
 * Use the `INDICATORS` constants for common series, or pass any valid FRED series ID.
 *
 * @param source - A `FredProvider` instance (or any object with `getSeries()`)
 * @param seriesId - FRED series ID, e.g. `INDICATORS.CPI` or `"CPIAUCSL"`
 * @param options - Date range and limit
 */
export async function getIndicator(
  source: MacroSource,
  seriesId: IndicatorId,
  options?: MacroOptions,
): Promise<MacroSeries> {
  return source.getSeries(seriesId, options);
}
