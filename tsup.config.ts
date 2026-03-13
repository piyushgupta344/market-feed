import { defineConfig } from "tsup";

const BANNER = "// market-feed — Unified financial market data client\n// https://github.com/piyushgupta344/market-feed";

const sharedConfig = {
  sourcemap: true,
  treeshake: true,
  splitting: false,
  minify: false,
  outDir: "dist",
  tsconfig: "./tsconfig.build.json",
  // react is a peer dependency — never bundle it
  external: ["react"] as string[],
} as const;

export default defineConfig([
  // Library entry points — ESM + CJS + .d.ts
  {
    ...sharedConfig,
    entry: {
      index:      "src/index.ts",
      stream:     "src/stream/index.ts",
      consensus:  "src/consensus/index.ts",
      calendar:   "src/calendar/index.ts",
      indicators: "src/indicators/index.ts",
      portfolio:  "src/portfolio/index.ts",
      ws:         "src/ws/index.ts",
      backtest:     "src/backtest/index.ts",
      alerts:       "src/alerts/index.ts",
      fundamentals: "src/fundamentals/index.ts",
      screener:     "src/screener/index.ts",
      react:        "src/react/index.ts",
      options:      "src/options/index.ts",
      macro:        "src/macro/index.ts",
      browser:      "src/browser/index.ts",
      trpc:         "src/trpc/index.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    banner: { js: BANNER },
  },
  // CLI binary — ESM only, no .d.ts, shebang prepended
  {
    ...sharedConfig,
    entry: { cli: "src/cli/index.ts" },
    format: ["esm"],
    dts: false,
    clean: false,
    banner: { js: `#!/usr/bin/env node\n${BANNER}` },
  },
]);
