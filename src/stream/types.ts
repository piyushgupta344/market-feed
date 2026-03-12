import type { ExchangeId } from "../calendar/types.js";
import type { MarketFeedError } from "../errors.js";
import type { EarningsEvent } from "../types/earnings.js";
import type { TradingSession } from "../types/market.js";
import type { Quote } from "../types/quote.js";

// ---------------------------------------------------------------------------
// Stream event types — exhaustive discriminated union
// ---------------------------------------------------------------------------

export interface QuoteEvent {
  type: "quote";
  symbol: string;
  quote: Quote;
  timestamp: Date;
}

export interface MarketOpenEvent {
  type: "market-open";
  exchange: ExchangeId;
  /** The session that just started: "pre" or "regular" */
  session: TradingSession;
  timestamp: Date;
}

export interface MarketCloseEvent {
  type: "market-close";
  exchange: ExchangeId;
  /** The session that just ended: "post" or "closed" */
  session: TradingSession;
  timestamp: Date;
}

export interface DivergenceEvent {
  type: "divergence";
  symbol: string;
  /** One quote per provider that responded */
  quotes: Quote[];
  /** (max - min) / mean × 100 */
  spreadPct: number;
  timestamp: Date;
}

export interface StreamErrorEvent {
  type: "error";
  error: MarketFeedError | Error;
  symbol?: string;
  /** false = the generator is about to terminate */
  recoverable: boolean;
  timestamp: Date;
}

/** Emitted when a new quarterly earnings report is detected for a watched symbol. */
export interface EarningsReleasedEvent {
  type: "earnings_released";
  symbol: string;
  /** The newly detected earnings report */
  earnings: EarningsEvent;
  timestamp: Date;
}

export type StreamEvent =
  | QuoteEvent
  | MarketOpenEvent
  | MarketCloseEvent
  | DivergenceEvent
  | StreamErrorEvent
  | EarningsReleasedEvent;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface WatchIntervalOptions {
  /** Milliseconds between polls during regular market hours. Default: 5 000 */
  open?: number;
  /** Milliseconds between polls during pre/post market. Default: 30 000 */
  prepost?: number;
  /** Milliseconds between polls when market is closed (check-for-open). Default: 60 000 */
  closed?: number;
}

export interface WatchOptions {
  /**
   * Exchange calendar to use for market-hours awareness.
   * Default: "NYSE"
   */
  exchange?: ExchangeId;

  /**
   * Per-session poll intervals. Granular overrides for each session type.
   */
  interval?: WatchIntervalOptions;

  /**
   * When true (default), pauses polling during closed sessions and emits
   * market-open / market-close events at session transitions.
   * When false, polls continuously at `interval.open` regardless of session.
   */
  marketHoursAware?: boolean;

  /**
   * Percentage price spread between providers that triggers a divergence event.
   * Only relevant when the MarketFeed has multiple providers configured.
   * Default: 0.5
   */
  divergenceThreshold?: number;

  /**
   * AbortSignal that stops the stream when aborted.
   */
  signal?: AbortSignal;

  /**
   * Maximum number of consecutive fetch errors before the generator throws.
   * Default: 5
   */
  maxErrors?: number;

  /**
   * When true, the stream monitors watched symbols for new quarterly earnings reports
   * and emits `earnings_released` events when a newer period is detected.
   * Default: false
   */
  includeFundamentals?: boolean;

  /**
   * How often to check for new earnings data, in milliseconds.
   * Only relevant when `includeFundamentals: true`.
   * Default: 900_000 (15 minutes)
   */
  fundamentalsIntervalMs?: number;
}
