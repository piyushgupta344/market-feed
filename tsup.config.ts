import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  minify: false,
  outDir: "dist",
  tsconfig: "./tsconfig.build.json",
  external: [],
  banner: {
    js: "// market-feed — Unified financial market data client\n// https://github.com/piyushgupta344/market-feed",
  },
});
