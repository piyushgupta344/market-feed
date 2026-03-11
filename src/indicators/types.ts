/** A single { date, value } result point for single-line indicators. */
export interface IndicatorPoint {
  date: Date;
  value: number;
}

/** MACD result point — includes the MACD line, signal line, and histogram. */
export interface MACDPoint {
  date: Date;
  /** MACD line = fast EMA − slow EMA */
  macd: number;
  /** Signal line = EMA(macdLine, signalPeriod) */
  signal: number;
  /** Histogram = macd − signal */
  histogram: number;
}

/** Bollinger Bands result point. */
export interface BollingerPoint {
  date: Date;
  /** Upper band = middle + stdDev × multiplier */
  upper: number;
  /** Middle band = SMA */
  middle: number;
  /** Lower band = middle − stdDev × multiplier */
  lower: number;
}

/** Stochastic Oscillator result point. */
export interface StochasticPoint {
  date: Date;
  /** %K — fast stochastic line */
  k: number;
  /** %D — slow stochastic (SMA of %K) */
  d: number;
}
