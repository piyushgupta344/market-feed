import { ProviderError } from "../errors.js";

export interface HttpClientOptions {
  /** Base URL prepended to every request path */
  baseUrl?: string;
  /** Default headers merged into every request */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds. Defaults to 10 000. */
  timeoutMs?: number;
  /** Number of retry attempts on transient failures. Defaults to 2. */
  retries?: number;
  /** Initial backoff in milliseconds for exponential retry. Defaults to 300. */
  retryDelayMs?: number;
}

export interface RequestOptions {
  params?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

/** HTTP status codes that are safe to retry */
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function buildUrl(
  base: string,
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): string {
  const url = new URL(path, base.endsWith("/") ? base : `${base}/`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly retryDelayMs: number;

  constructor(
    private readonly providerName: string,
    options: HttpClientOptions = {},
  ) {
    this.baseUrl = options.baseUrl ?? "";
    this.defaultHeaders = {
      Accept: "application/json",
      "User-Agent": "market-feed/0.1.0 (+https://github.com/piyushgupta344/market-feed)",
      ...options.headers,
    };
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.retries = options.retries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 300;
  }

  async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = buildUrl(this.baseUrl, path, options.params);
    const headers = { ...this.defaultHeaders, ...options.headers };
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;

    let lastError: unknown;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      if (attempt > 0) {
        // Exponential backoff: 300ms, 600ms, 1200ms...
        await sleep(this.retryDelayMs * 2 ** (attempt - 1));
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: "GET",
          headers,
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          if (RETRYABLE_STATUSES.has(response.status) && attempt < this.retries) {
            lastError = new ProviderError(
              `HTTP ${response.status} from ${url}`,
              this.providerName,
              response.status,
            );
            continue;
          }
          throw new ProviderError(
            `HTTP ${response.status} ${response.statusText} from ${url}`,
            this.providerName,
            response.status,
          );
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json") && !contentType.includes("text/plain")) {
          // Some financial APIs return JSON with a non-standard content-type
        }

        return (await response.json()) as T;
      } catch (err) {
        clearTimeout(timer);

        if (err instanceof ProviderError) {
          throw err;
        }

        if (err instanceof Error && err.name === "AbortError") {
          throw new ProviderError(
            `Request to ${url} timed out after ${timeoutMs}ms`,
            this.providerName,
          );
        }

        if (attempt < this.retries) {
          lastError = err;
          continue;
        }

        throw new ProviderError(
          `Network error fetching ${url}: ${err instanceof Error ? err.message : String(err)}`,
          this.providerName,
          undefined,
          err,
        );
      }
    }

    throw new ProviderError(
      `Failed after ${this.retries + 1} attempts`,
      this.providerName,
      undefined,
      lastError,
    );
  }
}
