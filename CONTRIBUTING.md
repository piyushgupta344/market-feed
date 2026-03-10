# Contributing to market-feed

Thank you for your interest in contributing!

## Setup

```bash
# Clone the repo
git clone https://github.com/piyushgupta344/market-feed
cd market-feed

# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Type-check
pnpm typecheck

# Lint & format
pnpm lint:fix
```

## Project Structure

```
src/
  types/        — Unified type definitions (public API)
  providers/    — One directory per data source
    yahoo/      — index.ts, types.ts, transform.ts
    alpha-vantage/
    polygon/
  cache/        — CacheDriver interface + MemoryCacheDriver
  http/         — Fetch wrapper with retry/timeout
  utils/        — Rate limiter, symbol helpers
  client.ts     — MarketFeed class
  errors.ts     — Error types
tests/
  unit/         — Mocked tests (no network)
  integration/  — Real API tests (skipped in CI without keys)
  fixtures/     — Recorded API responses (JSON)
```

## Adding a New Provider

1. Create `src/providers/<name>/`
2. Add `types.ts` — raw API response shapes
3. Add `transform.ts` — convert raw → unified types
4. Add `index.ts` — implement the `MarketProvider` interface
5. Export from `src/index.ts`
6. Add unit tests in `tests/unit/providers/<name>.test.ts`
7. Add fixtures in `tests/fixtures/<name>-*.json`
8. Document in README.md

The `MarketProvider` interface only requires `quote()`, `historical()`, and `search()`.
Optional methods: `company()`, `news()`, `marketStatus()`.

## Adding a Fixture

Fixtures are real API responses recorded once and stored as JSON.
To add one:

```bash
# Fetch and save a real response (example)
curl "https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=1d" \
  -H "Accept: application/json" \
  > tests/fixtures/yahoo-quote-aapl.json
```

Then reference it in your test with a `vi.stubGlobal("fetch", ...)` mock.

## Changesets

All user-facing changes need a changeset:

```bash
pnpm changeset
# Follow prompts: choose "patch", "minor", or "major"
# Describe what changed
```

Changesets are consumed during release to generate CHANGELOG.md entries
and bump the npm version automatically.

## Code Style

- Enforced by Biome (runs in CI)
- No `any` — use `unknown` + type guards instead
- Prefer `const` over `let`
- No external dependencies in `src/` (only `devDependencies`)

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add Finnhub provider
fix: handle Yahoo null bar in historical response
docs: add Redis cache driver example to README
test: add polygon news fixtures
chore: update vitest to 2.x
```

## Pull Request Checklist

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (all unit tests)
- [ ] Changeset added for user-facing changes
- [ ] README updated if new feature / API change
