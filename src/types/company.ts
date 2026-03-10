export interface CompanyProfile {
  symbol: string;
  name: string;
  description?: string;
  sector?: string;
  industry?: string;
  /** ISO 3166-1 alpha-2 country code, e.g. "US" */
  country?: string;
  employees?: number;
  website?: string;
  ceo?: string;
  /** Market cap in USD */
  marketCap?: number;
  /** Price-to-earnings ratio */
  peRatio?: number;
  /** Forward PE ratio */
  forwardPE?: number;
  /** Price-to-book ratio */
  priceToBook?: number;
  /** Annual dividend yield as a decimal, e.g. 0.015 = 1.5% */
  dividendYield?: number;
  /** Beta (5Y monthly) */
  beta?: number;
  /** Exchange identifier */
  exchange?: string;
  /** Currency */
  currency?: string;
  /** IPO date */
  ipoDate?: Date;
  provider: string;
  raw?: unknown;
}

export interface CompanyOptions {
  raw?: boolean;
}
