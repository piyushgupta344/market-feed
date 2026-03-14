/**
 * market-feed/trpc
 *
 * Framework-agnostic procedure router for market-feed.
 *
 * `createMarketFeedRouter(feed)` returns a plain object of typed async
 * procedures. Each procedure takes a single, serialisable input object and
 * returns a Promise of typed market data.
 *
 * This design works as-is (call procedures directly), adapts to tRPC with
 * zero boilerplate, and can be used as HTTP handlers or GraphQL resolvers.
 *
 * Zero production dependencies — no `@trpc/server`, no `zod` required.
 *
 * @example tRPC v11 integration
 * ```ts
 * import { initTRPC } from "@trpc/server";
 * import { z } from "zod";
 * import { createMarketFeedRouter } from "market-feed/trpc";
 * import { MarketFeed } from "market-feed";
 *
 * const t = initTRPC.create();
 * const mf = createMarketFeedRouter(new MarketFeed());
 *
 * export const appRouter = t.router({
 *   quote:    t.procedure.input(z.object({ symbols: z.array(z.string()) })).query(({ input }) => mf.quote(input)),
 *   company:  t.procedure.input(z.object({ symbol: z.string() })).query(({ input }) => mf.company(input)),
 *   news:     t.procedure.input(z.object({ symbol: z.string(), limit: z.number().optional() })).query(({ input }) => mf.news(input)),
 * });
 * ```
 *
 * @example HTTP handler (fetch-compatible)
 * ```ts
 * import { createMarketFeedRouter, createHttpHandler } from "market-feed/trpc";
 * import { MarketFeed } from "market-feed";
 *
 * const handler = createHttpHandler(createMarketFeedRouter(new MarketFeed()));
 *
 * // Next.js App Router / Cloudflare Workers / Deno
 * export { handler as GET, handler as POST };
 * ```
 *
 * @example Standalone — call procedures directly
 * ```ts
 * import { createMarketFeedRouter } from "market-feed/trpc";
 * import { MarketFeed } from "market-feed";
 *
 * const mf = createMarketFeedRouter(new MarketFeed());
 *
 * const { quotes } = await mf.quote({ symbols: ["AAPL", "MSFT"] });
 * const company     = await mf.company({ symbol: "AAPL" });
 * const news        = await mf.news({ symbol: "TSLA", limit: 5 });
 * ```
 */

import type { CompanyProfile } from "../types/company.js";
import type { DividendEvent } from "../types/dividends.js";
import type { EarningsEvent } from "../types/earnings.js";
import type {
  BalanceSheet,
  CashFlowStatement,
  FundamentalsOptions,
  IncomeStatement,
} from "../types/fundamentals.js";
import type { HistoricalBar, HistoricalOptions } from "../types/historical.js";
import type { NewsItem } from "../types/news.js";
import type { OptionChain, OptionChainOptions } from "../types/options.js";
import type { Quote } from "../types/quote.js";
import type { SearchResult } from "../types/search.js";
import type { SplitEvent } from "../types/splits.js";

// ---------------------------------------------------------------------------
// Internal duck-typed feed interface
// (Matches the MarketFeed class surface without importing the class directly,
//  keeping this module usable with custom feed implementations.)
// ---------------------------------------------------------------------------

interface FeedLike {
  quote(symbols: string[]): Promise<Quote[]>;
  historical(symbol: string, options?: HistoricalOptions): Promise<HistoricalBar[]>;
  search(query: string, options?: { limit?: number }): Promise<SearchResult[]>;
  company?(symbol: string): Promise<CompanyProfile>;
  news?(symbol: string, options?: { limit?: number }): Promise<NewsItem[]>;
  earnings?(symbol: string): Promise<EarningsEvent[]>;
  dividends?(symbol: string): Promise<DividendEvent[]>;
  splits?(symbol: string): Promise<SplitEvent[]>;
  incomeStatements?(symbol: string, options?: FundamentalsOptions): Promise<IncomeStatement[]>;
  balanceSheets?(symbol: string, options?: FundamentalsOptions): Promise<BalanceSheet[]>;
  cashFlows?(symbol: string, options?: FundamentalsOptions): Promise<CashFlowStatement[]>;
  optionChain?(symbol: string, options?: OptionChainOptions): Promise<OptionChain>;
}

// ---------------------------------------------------------------------------
// Input / output types — one object per procedure
// ---------------------------------------------------------------------------

export interface QuoteInput {
  symbols: string[];
}
export interface QuoteOutput {
  quotes: Quote[];
}

export interface HistoricalInput {
  symbol: string;
  options?: HistoricalOptions;
}
export type HistoricalOutput = HistoricalBar[];

export interface SearchInput {
  query: string;
  limit?: number;
}
export type SearchOutput = SearchResult[];

export interface SymbolInput {
  symbol: string;
}

export interface NewsInput {
  symbol: string;
  limit?: number;
}

export interface FundamentalsInput {
  symbol: string;
  options?: FundamentalsOptions;
}

export interface OptionChainInput {
  symbol: string;
  options?: OptionChainOptions;
}

// ---------------------------------------------------------------------------
// MarketFeedRouter — the procedure registry
// ---------------------------------------------------------------------------

/**
 * A plain typed object of async procedures.
 *
 * Optional procedures (company, news, earnings, …) are only present when the
 * underlying feed supports them.
 */
export interface MarketFeedRouter {
  /** Fetch live quotes for one or more symbols. */
  quote(input: QuoteInput): Promise<QuoteOutput>;

  /** Fetch OHLCV historical bars for a symbol. */
  historical(input: HistoricalInput): Promise<HistoricalOutput>;

  /** Search for symbols by name or ticker. */
  search(input: SearchInput): Promise<SearchOutput>;

  /** Fetch company profile / metadata. */
  company(input: SymbolInput): Promise<CompanyProfile>;

  /** Fetch recent news articles for a symbol. */
  news(input: NewsInput): Promise<NewsItem[]>;

  /** Fetch historical earnings events for a symbol. */
  earnings(input: SymbolInput): Promise<EarningsEvent[]>;

  /** Fetch historical dividend events for a symbol. */
  dividends(input: SymbolInput): Promise<DividendEvent[]>;

  /** Fetch historical stock split events for a symbol. */
  splits(input: SymbolInput): Promise<SplitEvent[]>;

  /** Fetch annual / quarterly income statements. */
  incomeStatements(input: FundamentalsInput): Promise<IncomeStatement[]>;

  /** Fetch annual / quarterly balance sheets. */
  balanceSheets(input: FundamentalsInput): Promise<BalanceSheet[]>;

  /** Fetch annual / quarterly cash flow statements. */
  cashFlows(input: FundamentalsInput): Promise<CashFlowStatement[]>;

  /** Fetch the full options chain for a symbol. */
  optionChain(input: OptionChainInput): Promise<OptionChain>;
}

// ---------------------------------------------------------------------------
// createMarketFeedRouter
// ---------------------------------------------------------------------------

/**
 * Create a `MarketFeedRouter` backed by the given `feed`.
 *
 * Each procedure accepts a single plain input object and returns a Promise of
 * typed market data. Use the router directly, adapt to tRPC, or pass to
 * `createHttpHandler`.
 *
 * @param feed - A `MarketFeed` instance (or any duck-typed equivalent)
 */
export function createMarketFeedRouter(feed: FeedLike): MarketFeedRouter {
  return {
    quote: async ({ symbols }) => ({ quotes: await feed.quote(symbols) }),

    historical: ({ symbol, options }) => feed.historical(symbol, options),

    search: ({ query, limit }) => feed.search(query, { limit }),

    company: ({ symbol }) => {
      if (!feed.company)
        return Promise.reject(new Error("company() is not supported by this feed"));
      return feed.company(symbol);
    },

    news: ({ symbol, limit }) => {
      if (!feed.news) return Promise.reject(new Error("news() is not supported by this feed"));
      return feed.news(symbol, { limit });
    },

    earnings: ({ symbol }) => {
      if (!feed.earnings)
        return Promise.reject(new Error("earnings() is not supported by this feed"));
      return feed.earnings(symbol);
    },

    dividends: ({ symbol }) => {
      if (!feed.dividends)
        return Promise.reject(new Error("dividends() is not supported by this feed"));
      return feed.dividends(symbol);
    },

    splits: ({ symbol }) => {
      if (!feed.splits) return Promise.reject(new Error("splits() is not supported by this feed"));
      return feed.splits(symbol);
    },

    incomeStatements: ({ symbol, options }) => {
      if (!feed.incomeStatements)
        return Promise.reject(new Error("incomeStatements() is not supported by this feed"));
      return feed.incomeStatements(symbol, options);
    },

    balanceSheets: ({ symbol, options }) => {
      if (!feed.balanceSheets)
        return Promise.reject(new Error("balanceSheets() is not supported by this feed"));
      return feed.balanceSheets(symbol, options);
    },

    cashFlows: ({ symbol, options }) => {
      if (!feed.cashFlows)
        return Promise.reject(new Error("cashFlows() is not supported by this feed"));
      return feed.cashFlows(symbol, options);
    },

    optionChain: ({ symbol, options }) => {
      if (!feed.optionChain)
        return Promise.reject(new Error("optionChain() is not supported by this feed"));
      return feed.optionChain(symbol, options);
    },
  };
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

/**
 * Wrap a `MarketFeedRouter` as a fetch-compatible HTTP handler.
 *
 * All procedures are exposed on a single URL via `POST /{procedure}`.
 * The request body is parsed as JSON and passed as the procedure input.
 * The response is JSON-encoded.
 *
 * Compatible with Next.js App Router, Cloudflare Workers, Deno, and any
 * fetch-based server framework.
 *
 * @example
 * ```ts
 * // app/api/market/[procedure]/route.ts  (Next.js App Router)
 * import { createMarketFeedRouter, createHttpHandler } from "market-feed/trpc";
 * import { MarketFeed } from "market-feed";
 *
 * const handler = createHttpHandler(createMarketFeedRouter(new MarketFeed()));
 * export { handler as POST };
 * ```
 */
export function createHttpHandler(
  router: MarketFeedRouter,
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    // Procedure name is the last path segment: /api/market/quote → "quote"
    const procedure = url.pathname.split("/").filter(Boolean).pop() ?? "";

    if (!(procedure in router)) {
      return new Response(JSON.stringify({ error: `Unknown procedure: ${procedure}` }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    let input: unknown;
    try {
      const text = await request.text();
      input = text ? JSON.parse(text) : {};
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const handler = router[procedure as keyof MarketFeedRouter];
      const result = await (handler as (input: unknown) => Promise<unknown>)(input);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  };
}
