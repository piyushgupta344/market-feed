# Multi-Runtime Support

market-feed uses only the native `fetch` API and standard ES2022 features — no Node.js-specific APIs. It runs on any modern JavaScript runtime.

## Node.js 18+

Native `fetch` was added in Node 18. No polyfills needed.

```ts
// CommonJS
const { MarketFeed } = require("market-feed");

// ESM
import { MarketFeed } from "market-feed";
```

## Bun 1+

Works out of the box. Bun has native fetch and fast TypeScript execution.

```bash
bun add market-feed
```

```ts
import { MarketFeed } from "market-feed";

const feed = new MarketFeed();
const quote = await feed.quote("AAPL");
```

## Deno 2+

```ts
import { MarketFeed } from "npm:market-feed";

const feed = new MarketFeed();
const quote = await feed.quote("AAPL");
console.log(quote.price);
```

## Cloudflare Workers

```ts
import { MarketFeed, YahooProvider } from "market-feed";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const feed = new MarketFeed({
      providers: [new YahooProvider()],
      // Use Cloudflare KV for caching
      cache: { driver: cloudflareKVDriver(env.MY_KV) },
    });

    const url = new URL(request.url);
    const symbol = url.searchParams.get("symbol") ?? "AAPL";
    const quote = await feed.quote(symbol);

    return Response.json(quote);
  },
};
```

## Next.js (App Router)

```ts
// app/api/quote/route.ts
import { MarketFeed } from "market-feed";

const feed = new MarketFeed();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") ?? "AAPL";

  const quote = await feed.quote(symbol);
  return Response.json(quote);
}
```

::: warning Browser usage
market-feed cannot run in the browser — Yahoo Finance and most financial APIs block CORS requests from browsers. Run it server-side (API routes, server components, edge functions) and pass data to the client.
:::

## React Server Components

```tsx
// app/StockPrice.tsx (server component)
import { MarketFeed } from "market-feed";

const feed = new MarketFeed();

export async function StockPrice({ symbol }: { symbol: string }) {
  const quote = await feed.quote(symbol);

  return (
    <div>
      <span>{quote.symbol}</span>
      <span>${quote.price.toFixed(2)}</span>
      <span className={quote.changePercent >= 0 ? "green" : "red"}>
        {quote.changePercent >= 0 ? "+" : ""}{quote.changePercent.toFixed(2)}%
      </span>
    </div>
  );
}
```
