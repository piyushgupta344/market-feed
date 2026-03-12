import { describe, expect, it } from "vitest";
// We only test the pure arg-parsing logic — no network calls
import { parseArgs } from "../../../src/cli/index.js";

describe("CLI parseArgs()", () => {
  it("parses command and positional arguments", () => {
    const args = parseArgs(["node", "cli.js", "quote", "AAPL", "MSFT"]);
    expect(args.command).toBe("quote");
    expect(args.positionals).toEqual(["AAPL", "MSFT"]);
  });

  it("parses --json flag", () => {
    const args = parseArgs(["node", "cli.js", "quote", "AAPL", "--json"]);
    expect(args.json).toBe(true);
  });

  it("defaults json to false", () => {
    const args = parseArgs(["node", "cli.js", "quote", "AAPL"]);
    expect(args.json).toBe(false);
  });

  it("parses API key flags", () => {
    const args = parseArgs([
      "node", "cli.js", "quote", "AAPL",
      "--av-key", "av123",
      "--polygon-key", "poly456",
      "--finnhub-key", "fh789",
      "--td-key", "td000",
    ]);
    expect(args.avKey).toBe("av123");
    expect(args.polygonKey).toBe("poly456");
    expect(args.finnhubKey).toBe("fh789");
    expect(args.tdKey).toBe("td000");
  });

  it("parses --limit and --interval", () => {
    const args = parseArgs(["node", "cli.js", "historical", "AAPL", "--limit", "20", "--interval", "1wk"]);
    expect(args.limit).toBe(20);
    expect(args.interval).toBe("1wk");
  });

  it("defaults limit to 10 and interval to 1d", () => {
    const args = parseArgs(["node", "cli.js", "historical", "AAPL"]);
    expect(args.limit).toBe(10);
    expect(args.interval).toBe("1d");
  });

  it("parses --period1 and --period2", () => {
    const args = parseArgs([
      "node", "cli.js", "historical", "AAPL",
      "--period1", "2024-01-01",
      "--period2", "2024-12-31",
    ]);
    expect(args.period1).toBe("2024-01-01");
    expect(args.period2).toBe("2024-12-31");
  });

  it("sets command to help for -h", () => {
    const args = parseArgs(["node", "cli.js", "-h"]);
    expect(args.command).toBe("help");
  });

  it("sets command to help for --help", () => {
    const args = parseArgs(["node", "cli.js", "--help"]);
    expect(args.command).toBe("help");
  });

  it("handles search with multi-word query as positionals", () => {
    const args = parseArgs(["node", "cli.js", "search", "apple", "inc"]);
    expect(args.command).toBe("search");
    expect(args.positionals).toEqual(["apple", "inc"]);
  });

  it("handles no arguments gracefully", () => {
    const args = parseArgs(["node", "cli.js"]);
    expect(args.command).toBe("");
    expect(args.positionals).toEqual([]);
  });

  it("parses earnings command", () => {
    const args = parseArgs(["node", "cli.js", "earnings", "AAPL", "--limit", "8"]);
    expect(args.command).toBe("earnings");
    expect(args.positionals).toEqual(["AAPL"]);
    expect(args.limit).toBe(8);
  });

  it("parses dividends command with --from and --to", () => {
    const args = parseArgs([
      "node", "cli.js", "dividends", "AAPL",
      "--from", "2020-01-01",
      "--to", "2024-12-31",
    ]);
    expect(args.command).toBe("dividends");
    expect(args.positionals).toEqual(["AAPL"]);
    expect(args.from).toBe("2020-01-01");
    expect(args.to).toBe("2024-12-31");
  });

  it("parses splits command", () => {
    const args = parseArgs(["node", "cli.js", "splits", "AAPL", "--json"]);
    expect(args.command).toBe("splits");
    expect(args.positionals).toEqual(["AAPL"]);
    expect(args.json).toBe(true);
  });

  it("--from defaults to undefined", () => {
    const args = parseArgs(["node", "cli.js", "dividends", "AAPL"]);
    expect(args.from).toBeUndefined();
    expect(args.to).toBeUndefined();
  });
});
