/**
 * market-feed CLI
 *
 * Usage: market-feed <command> [options]
 * Run `market-feed --help` for full usage.
 */
import { MarketFeed } from "../client.js";
import { AlphaVantageProvider } from "../providers/alpha-vantage/index.js";
import { FinnhubProvider } from "../providers/finnhub/index.js";
import { PolygonProvider } from "../providers/polygon/index.js";
import { YahooProvider } from "../providers/yahoo/index.js";

const HELP = `
Usage: market-feed <command> [options]

Commands:
  quote      <symbol...>    Fetch real-time quote(s)
  historical <symbol>       Fetch OHLCV history
  search     <query>        Search for symbols
  company    <symbol>       Fetch company profile
  news       <symbol>       Fetch recent news
  earnings   <symbol>       Fetch EPS history (actuals vs. estimates)
  dividends  <symbol>       Fetch cash dividend history
  splits     <symbol>       Fetch stock split history

Options:
  --av-key <key>        Alpha Vantage API key
  --polygon-key <key>   Polygon.io API key
  --finnhub-key <key>   Finnhub API key
  --json                Output raw JSON
  --limit <n>           Limit results (default: 10)
  --interval <i>        Historical interval: 1m 5m 15m 30m 1h 1d 1wk 1mo (default: 1d)
  --period1 <date>      Historical start date (ISO 8601)
  --period2 <date>      Historical end date (ISO 8601)
  --from <date>         Dividends/splits start date (ISO 8601)
  --to <date>           Dividends/splits end date (ISO 8601)
  -h, --help            Show this help message

Examples:
  market-feed quote AAPL MSFT GOOGL
  market-feed historical AAPL --interval 1wk --period1 2024-01-01
  market-feed search "apple inc"
  market-feed company AAPL --json
  market-feed news AAPL --limit 5
  market-feed earnings AAPL --limit 8
  market-feed dividends AAPL --from 2020-01-01
  market-feed splits AAPL --json
`.trim();

interface CliArgs {
  command: string;
  positionals: string[];
  json: boolean;
  avKey?: string;
  polygonKey?: string;
  finnhubKey?: string;
  limit: number;
  interval: string;
  period1?: string;
  period2?: string;
  from?: string;
  to?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  const result: CliArgs = {
    command: "",
    positionals: [],
    json: false,
    limit: 10,
    interval: "1d",
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i]!;
    if (arg === "--json") {
      result.json = true;
      i++;
    } else if (arg === "-h" || arg === "--help") {
      result.command = "help";
      i++;
    } else if (arg === "--av-key") {
      result.avKey = args[++i];
      i++;
    } else if (arg === "--polygon-key") {
      result.polygonKey = args[++i];
      i++;
    } else if (arg === "--finnhub-key") {
      result.finnhubKey = args[++i];
      i++;
    } else if (arg === "--limit") {
      result.limit = Number(args[++i]) || 10;
      i++;
    } else if (arg === "--interval") {
      result.interval = args[++i] ?? "1d";
      i++;
    } else if (arg === "--period1") {
      result.period1 = args[++i];
      i++;
    } else if (arg === "--period2") {
      result.period2 = args[++i];
      i++;
    } else if (arg === "--from") {
      result.from = args[++i];
      i++;
    } else if (arg === "--to") {
      result.to = args[++i];
      i++;
    } else if (!arg.startsWith("-") && !result.command) {
      result.command = arg;
      i++;
    } else if (!arg.startsWith("-")) {
      result.positionals.push(arg);
      i++;
    } else {
      i++;
    }
  }
  return result;
}

function buildFeed(args: CliArgs): MarketFeed {
  const providers: InstanceType<typeof YahooProvider | typeof AlphaVantageProvider | typeof PolygonProvider | typeof FinnhubProvider>[] = [
    new YahooProvider(),
  ];
  if (args.avKey) providers.push(new AlphaVantageProvider({ apiKey: args.avKey }));
  if (args.polygonKey) providers.push(new PolygonProvider({ apiKey: args.polygonKey }));
  if (args.finnhubKey) providers.push(new FinnhubProvider({ apiKey: args.finnhubKey }));
  return new MarketFeed({ providers });
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function pad(s: string, n: number): string {
  const str = String(s);
  return str.length >= n ? str.slice(0, n) : str + " ".repeat(n - str.length);
}

function fmtNum(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

function fmtChange(change: number, changePct: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${fmtNum(change)} (${sign}${fmtNum(changePct)}%)`;
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

async function runQuote(feed: MarketFeed, symbols: string[], asJson: boolean): Promise<void> {
  const quotes = await feed.quote(symbols);
  if (asJson) {
    console.log(JSON.stringify(quotes, null, 2));
    return;
  }
  console.log(
    `${pad("Symbol", 8)} ${pad("Price", 10)} ${pad("Change", 24)} ${pad("Volume", 14)} Provider`,
  );
  console.log("-".repeat(72));
  for (const q of quotes) {
    console.log(
      `${pad(q.symbol, 8)} ${pad(fmtNum(q.price), 10)} ${pad(fmtChange(q.change, q.changePercent), 24)} ${pad(q.volume.toLocaleString(), 14)} ${q.provider}`,
    );
  }
}

async function runHistorical(feed: MarketFeed, symbol: string, args: CliArgs): Promise<void> {
  const bars = await feed.historical(symbol, {
    interval: args.interval as "1d",
    ...(args.period1 ? { period1: args.period1 } : {}),
    ...(args.period2 ? { period2: args.period2 } : {}),
  });
  if (args.json) {
    console.log(JSON.stringify(bars, null, 2));
    return;
  }
  console.log(
    `${pad("Date", 12)} ${pad("Open", 10)} ${pad("High", 10)} ${pad("Low", 10)} ${pad("Close", 10)} Volume`,
  );
  console.log("-".repeat(68));
  for (const b of bars.slice(-args.limit)) {
    console.log(
      `${pad(b.date.toISOString().slice(0, 10), 12)} ${pad(fmtNum(b.open), 10)} ${pad(fmtNum(b.high), 10)} ${pad(fmtNum(b.low), 10)} ${pad(fmtNum(b.close), 10)} ${b.volume.toLocaleString()}`,
    );
  }
}

async function runSearch(feed: MarketFeed, query: string, args: CliArgs): Promise<void> {
  const results = await feed.search(query, { limit: args.limit });
  if (args.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  console.log(`${pad("Symbol", 10)} ${pad("Name", 36)} ${pad("Type", 12)} Exchange`);
  console.log("-".repeat(72));
  for (const r of results) {
    console.log(
      `${pad(r.symbol, 10)} ${pad(r.name, 36)} ${pad(r.type, 12)} ${r.exchange ?? ""}`,
    );
  }
}

async function runCompany(feed: MarketFeed, symbol: string, asJson: boolean): Promise<void> {
  const profile = await feed.company(symbol);
  if (asJson) {
    console.log(JSON.stringify(profile, null, 2));
    return;
  }
  console.log(`\n  ${profile.name} (${profile.symbol})`);
  if (profile.sector) console.log(`  Sector:    ${profile.sector}`);
  if (profile.industry) console.log(`  Industry:  ${profile.industry}`);
  if (profile.country) console.log(`  Country:   ${profile.country}`);
  if (profile.employees) console.log(`  Employees: ${profile.employees.toLocaleString()}`);
  if (profile.marketCap) console.log(`  Mkt Cap:   $${(profile.marketCap / 1e9).toFixed(2)}B`);
  if (profile.peRatio) console.log(`  P/E:       ${profile.peRatio.toFixed(2)}`);
  if (profile.website) console.log(`  Website:   ${profile.website}`);
  console.log(`  Provider:  ${profile.provider}\n`);
}

async function runNews(feed: MarketFeed, symbol: string, args: CliArgs): Promise<void> {
  const news = await feed.news(symbol, { limit: args.limit });
  if (args.json) {
    console.log(JSON.stringify(news, null, 2));
    return;
  }
  console.log("");
  for (const item of news) {
    const date = item.publishedAt.toISOString().slice(0, 10);
    console.log(`  [${date}] ${item.title}`);
    console.log(`  ${item.source} — ${item.url}`);
    if (item.summary) {
      const excerpt = item.summary.length > 100 ? `${item.summary.slice(0, 100)}…` : item.summary;
      console.log(`  ${excerpt}`);
    }
    console.log("");
  }
}

async function runEarnings(feed: MarketFeed, symbol: string, args: CliArgs): Promise<void> {
  const events = await feed.earnings(symbol, { limit: args.limit });
  if (args.json) {
    console.log(JSON.stringify(events, null, 2));
    return;
  }
  if (events.length === 0) {
    console.log("No earnings data found.");
    return;
  }
  console.log(
    `${pad("Date", 12)} ${pad("Period", 12)} ${pad("Actual", 9)} ${pad("Estimate", 9)} ${pad("Surprise%", 10)} Provider`,
  );
  console.log("-".repeat(70));
  for (const e of events) {
    const date = e.date.toISOString().slice(0, 10);
    const period = e.period ?? "-";
    const actual = e.epsActual !== undefined ? fmtNum(e.epsActual, 2) : "-";
    const estimate = e.epsEstimate !== undefined ? fmtNum(e.epsEstimate, 2) : "-";
    const surprise =
      e.epsSurprisePct !== undefined
        ? `${e.epsSurprisePct >= 0 ? "+" : ""}${fmtNum(e.epsSurprisePct, 2)}%`
        : "-";
    console.log(
      `${pad(date, 12)} ${pad(period, 12)} ${pad(actual, 9)} ${pad(estimate, 9)} ${pad(surprise, 10)} ${e.provider}`,
    );
  }
}

async function runDividends(feed: MarketFeed, symbol: string, args: CliArgs): Promise<void> {
  const events = await feed.dividends(symbol, {
    limit: args.limit,
    ...(args.from ? { from: args.from } : {}),
    ...(args.to ? { to: args.to } : {}),
  });
  if (args.json) {
    console.log(JSON.stringify(events, null, 2));
    return;
  }
  if (events.length === 0) {
    console.log("No dividend data found.");
    return;
  }
  console.log(
    `${pad("Ex Date", 12)} ${pad("Amount", 9)} ${pad("Frequency", 14)} ${pad("Pay Date", 12)} Provider`,
  );
  console.log("-".repeat(66));
  for (const e of events) {
    const exDate = e.exDate.toISOString().slice(0, 10);
    const amount = `$${fmtNum(e.amount, 4)}`;
    const freq = e.frequency ?? "-";
    const payDate = e.payDate ? e.payDate.toISOString().slice(0, 10) : "-";
    console.log(
      `${pad(exDate, 12)} ${pad(amount, 9)} ${pad(freq, 14)} ${pad(payDate, 12)} ${e.provider}`,
    );
  }
}

async function runSplits(feed: MarketFeed, symbol: string, args: CliArgs): Promise<void> {
  const events = await feed.splits(symbol, {
    limit: args.limit,
    ...(args.from ? { from: args.from } : {}),
    ...(args.to ? { to: args.to } : {}),
  });
  if (args.json) {
    console.log(JSON.stringify(events, null, 2));
    return;
  }
  if (events.length === 0) {
    console.log("No split data found.");
    return;
  }
  console.log(`${pad("Date", 12)} ${pad("Ratio", 8)} ${pad("Description", 14)} Provider`);
  console.log("-".repeat(50));
  for (const e of events) {
    const date = e.date.toISOString().slice(0, 10);
    const ratio = fmtNum(e.ratio, 4);
    const desc = e.description ?? "-";
    console.log(`${pad(date, 12)} ${pad(ratio, 8)} ${pad(desc, 14)} ${e.provider}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (!args.command || args.command === "help") {
    console.log(HELP);
    process.exit(0);
  }

  const feed = buildFeed(args);

  try {
    switch (args.command) {
      case "quote": {
        const symbols = args.positionals;
        if (symbols.length === 0) {
          console.error("Error: quote requires at least one symbol\n");
          process.exit(1);
        }
        await runQuote(feed, symbols, args.json);
        break;
      }
      case "historical": {
        const [symbol] = args.positionals;
        if (!symbol) {
          console.error("Error: historical requires a symbol\n");
          process.exit(1);
        }
        await runHistorical(feed, symbol, args);
        break;
      }
      case "search": {
        const query = args.positionals.join(" ");
        if (!query) {
          console.error("Error: search requires a query string\n");
          process.exit(1);
        }
        await runSearch(feed, query, args);
        break;
      }
      case "company": {
        const [symbol] = args.positionals;
        if (!symbol) {
          console.error("Error: company requires a symbol\n");
          process.exit(1);
        }
        await runCompany(feed, symbol, args.json);
        break;
      }
      case "news": {
        const [symbol] = args.positionals;
        if (!symbol) {
          console.error("Error: news requires a symbol\n");
          process.exit(1);
        }
        await runNews(feed, symbol, args);
        break;
      }
      case "earnings": {
        const [symbol] = args.positionals;
        if (!symbol) {
          console.error("Error: earnings requires a symbol\n");
          process.exit(1);
        }
        await runEarnings(feed, symbol, args);
        break;
      }
      case "dividends": {
        const [symbol] = args.positionals;
        if (!symbol) {
          console.error("Error: dividends requires a symbol\n");
          process.exit(1);
        }
        await runDividends(feed, symbol, args);
        break;
      }
      case "splits": {
        const [symbol] = args.positionals;
        if (!symbol) {
          console.error("Error: splits requires a symbol\n");
          process.exit(1);
        }
        await runSplits(feed, symbol, args);
        break;
      }
      default: {
        console.error(`Unknown command: "${args.command}"\n`);
        console.log(HELP);
        process.exit(1);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${msg}`);
    process.exit(1);
  }
}

// Guard against running when imported in tests
if (!process.env["VITEST"]) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}

// Export parseArgs for unit testing
export { parseArgs };
