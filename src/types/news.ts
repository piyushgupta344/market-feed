export interface NewsItem {
  /** Provider-specific unique ID */
  id: string;
  title: string;
  summary?: string;
  url: string;
  /** Publisher / source name */
  source: string;
  publishedAt: Date;
  /** Ticker symbols mentioned in this article */
  symbols: string[];
  /** Thumbnail image URL */
  thumbnail?: string;
  provider: string;
  raw?: unknown;
}

export interface NewsOptions {
  /** Maximum number of articles to return. Defaults to 10. */
  limit?: number;
  raw?: boolean;
}
