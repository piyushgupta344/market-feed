# tRPC / HTTP Router

`market-feed/trpc` exposes a typed, framework-agnostic procedure router over the full market-feed API. Zero production dependencies — no `@trpc/server` or `zod` required.

## Overview

`createMarketFeedRouter(feed)` returns a plain object of async procedures. Each procedure accepts a single serialisable input object and returns a typed Promise.

Use the router:
- **Directly** — call procedures from any server-side code
- **With tRPC** — wrap each procedure with `t.procedure` for end-to-end type safety
- **As an HTTP handler** — expose via `createHttpHandler()` for a REST-style API
- **As GraphQL resolvers** — use directly as resolver functions

## Basic usage

```ts
import { createMarketFeedRouter } from "market-feed/trpc";
import { MarketFeed } from "market-feed";

const mf = createMarketFeedRouter(new MarketFeed());

// Call procedures directly
const { quotes } = await mf.quote({ symbols: ["AAPL", "MSFT"] });
const bars        = await mf.historical({ symbol: "AAPL" });
const results     = await mf.search({ query: "tesla", limit: 5 });
const company     = await mf.company({ symbol: "TSLA" });
const news        = await mf.news({ symbol: "AAPL", limit: 10 });
```

## tRPC v11 integration

```ts
import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { createMarketFeedRouter } from "market-feed/trpc";
import { MarketFeed } from "market-feed";

const t = initTRPC.create();
const mf = createMarketFeedRouter(new MarketFeed());

export const appRouter = t.router({
  quote: t.procedure
    .input(z.object({ symbols: z.array(z.string()) }))
    .query(({ input }) => mf.quote(input)),

  historical: t.procedure
    .input(z.object({
      symbol: z.string(),
      options: z.object({
        period1: z.string().optional(),
        period2: z.string().optional(),
        interval: z.string().optional(),
      }).optional(),
    }))
    .query(({ input }) => mf.historical(input)),

  company: t.procedure
    .input(z.object({ symbol: z.string() }))
    .query(({ input }) => mf.company(input)),

  news: t.procedure
    .input(z.object({ symbol: z.string(), limit: z.number().optional() }))
    .query(({ input }) => mf.news(input)),

  search: t.procedure
    .input(z.object({ query: z.string(), limit: z.number().optional() }))
    .query(({ input }) => mf.search(input)),
});

export type AppRouter = typeof appRouter;
```

## HTTP handler

`createHttpHandler(router)` returns a fetch-compatible handler. Routes are identified by the last path segment: `POST /api/market/quote` calls `router.quote(body)`.

```ts
import { createMarketFeedRouter, createHttpHandler } from "market-feed/trpc";
import { MarketFeed } from "market-feed";

const handler = createHttpHandler(createMarketFeedRouter(new MarketFeed()));
```

### Next.js App Router

```ts
// app/api/market/[procedure]/route.ts
import { createMarketFeedRouter, createHttpHandler } from "market-feed/trpc";
import { MarketFeed } from "market-feed";

const handler = createHttpHandler(createMarketFeedRouter(new MarketFeed()));
export { handler as POST };
```

### Cloudflare Workers

```ts
import { createMarketFeedRouter, createHttpHandler } from "market-feed/trpc";
import { MarketFeed } from "market-feed";

const handler = createHttpHandler(createMarketFeedRouter(new MarketFeed()));

export default {
  fetch(request: Request): Promise<Response> {
    return handler(request);
  },
};
```

### HTTP response codes

| Status | Meaning |
|--------|---------|
| `200` | Success — body is the JSON-encoded procedure output |
| `400` | Request body is not valid JSON |
| `404` | No procedure matches the path segment |
| `500` | Procedure threw an error — body is `{ "error": "..." }` |

### Example requests

```bash
# Quote
curl -X POST https://your-api.example.com/api/market/quote \
  -H "Content-Type: application/json" \
  -d '{"symbols":["AAPL","MSFT"]}'

# Historical
curl -X POST https://your-api.example.com/api/market/historical \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","options":{"period1":"2025-01-01"}}'

# Company
curl -X POST https://your-api.example.com/api/market/company \
  -H "Content-Type: application/json" \
  -d '{"symbol":"TSLA"}'
```

## GraphQL resolvers

```ts
import { createMarketFeedRouter } from "market-feed/trpc";
import { MarketFeed } from "market-feed";

const mf = createMarketFeedRouter(new MarketFeed());

// type-graphql / nexus / pothos — use mf.* as resolver functions
const resolvers = {
  Query: {
    quote:   (_: unknown, { symbols }: { symbols: string[] }) => mf.quote({ symbols }),
    company: (_: unknown, { symbol }: { symbol: string })     => mf.company({ symbol }),
    news:    (_: unknown, { symbol }: { symbol: string })     => mf.news({ symbol }),
  },
};
```

## Procedure reference

| Procedure | Input | Output |
|-----------|-------|--------|
| `quote` | `{ symbols: string[] }` | `{ quotes: Quote[] }` |
| `historical` | `{ symbol, options? }` | `HistoricalBar[]` |
| `search` | `{ query, limit? }` | `SearchResult[]` |
| `company` | `{ symbol }` | `CompanyProfile` |
| `news` | `{ symbol, limit? }` | `NewsItem[]` |
| `earnings` | `{ symbol }` | `EarningsEvent[]` |
| `dividends` | `{ symbol }` | `DividendEvent[]` |
| `splits` | `{ symbol }` | `SplitEvent[]` |
| `incomeStatements` | `{ symbol, options? }` | `IncomeStatement[]` |
| `balanceSheets` | `{ symbol, options? }` | `BalanceSheet[]` |
| `cashFlows` | `{ symbol, options? }` | `CashFlowStatement[]` |
| `optionChain` | `{ symbol, options? }` | `OptionChain` |

Optional procedures (everything except `quote`, `historical`, `search`) reject with an error if the underlying feed/provider does not support them.

## Types

```ts
interface MarketFeedRouter {
  quote(input: { symbols: string[] }): Promise<{ quotes: Quote[] }>;
  historical(input: { symbol: string; options?: HistoricalOptions }): Promise<HistoricalBar[]>;
  search(input: { query: string; limit?: number }): Promise<SearchResult[]>;
  company(input: { symbol: string }): Promise<CompanyProfile>;
  news(input: { symbol: string; limit?: number }): Promise<NewsItem[]>;
  earnings(input: { symbol: string }): Promise<EarningsEvent[]>;
  dividends(input: { symbol: string }): Promise<DividendEvent[]>;
  splits(input: { symbol: string }): Promise<SplitEvent[]>;
  incomeStatements(input: { symbol: string; options?: FundamentalsOptions }): Promise<IncomeStatement[]>;
  balanceSheets(input: { symbol: string; options?: FundamentalsOptions }): Promise<BalanceSheet[]>;
  cashFlows(input: { symbol: string; options?: FundamentalsOptions }): Promise<CashFlowStatement[]>;
  optionChain(input: { symbol: string; options?: OptionChainOptions }): Promise<OptionChain>;
}
```
