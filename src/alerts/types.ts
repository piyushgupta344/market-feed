import type { Quote } from "../types/quote.js";

export type AlertCondition =
  | { type: "price_above"; threshold: number }
  | { type: "price_below"; threshold: number }
  | { type: "change_pct_above"; threshold: number }
  | { type: "change_pct_below"; threshold: number }
  | { type: "volume_above"; threshold: number };

export interface AlertConfig {
  symbol: string;
  condition: AlertCondition;
  /** Emit this alert at most once, then stop watching it. Defaults to false. */
  once?: boolean;
  /**
   * Suppress re-fires within this many milliseconds after the last trigger.
   * Defaults to 0 (no debounce).
   */
  debounceMs?: number;
}

export interface AlertEvent {
  type: "triggered";
  alert: AlertConfig;
  quote: Quote;
  triggeredAt: Date;
}

export interface AlertsOptions {
  /** Poll interval in milliseconds. Defaults to 5 000. */
  intervalMs?: number;
  /** AbortSignal to stop the generator. */
  signal?: AbortSignal;
}
