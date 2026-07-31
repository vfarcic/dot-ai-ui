# Claude Code Instructions

## Project Overview

This is the Web UI visualization companion for the dot-ai MCP server. It renders visualizations (Mermaid diagrams, cards, code blocks, tables) for MCP tool responses.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4
- **Backend**: Express (proxy for MCP authentication)
- **Visualization**: Mermaid.js, Prism.js

## Development

```bash
./scripts/dev-start.sh  # Start dev server (cleans ports, sets MCP config)
./scripts/dev-stop.sh   # Stop dev server and clean up ports
npm run build           # Build for production
npm run start           # Run production server
```

The dev scripts handle port cleanup. Required environment variables (must be set before running):
- `DOT_AI_MCP_URL` - MCP server URL (e.g., `http://localhost:8080`)
- `DOT_AI_AUTH_TOKEN` - Auth token for MCP server

### Error Classification

The API client (`src/api/client.ts`) classifies errors by type. Important: "session-expired" errors are ONLY triggered by the explicit `SESSION_NOT_FOUND` error code from MCP, not generic 404s. This prevents false "session expired" errors during Vite HMR restarts.

## MCP Integration

This UI communicates with the dot-ai MCP server via **HTTP REST endpoints only** (e.g., `/api/v1/resources`, `/api/v1/events`, `/api/v1/logs`). When searching for MCP capabilities or requesting new features, always look for or request **HTTP REST endpoints**, not MCP tools. The Express backend proxies these REST calls to the MCP server with authentication.

## Testing Requirements

**Always verify new UI features with Playwright before considering them complete.**

After implementing any frontend changes:

1. Start the dev server if not running
2. Use `mcp__playwright__browser_navigate` to open the relevant page
3. Use `mcp__playwright__browser_snapshot` to capture the page state
4. Verify the feature renders correctly
5. Test interactions if applicable (clicks, tab switching, etc.)

This ensures visual correctness and catches rendering issues that build checks miss.

**Dev server**: `http://localhost:3000`
**Test route**: `/v/{sessionId}` (get fresh sessionId from MCP server)

## Unit Tests

Vitest covers logic that doesn't need a browser: pure functions, API-client behavior, and
individual components via Testing Library + jsdom.

```bash
npm run test:unit           # Run once
npm run test:unit:watch     # Re-run on change
npm run test:unit:ui        # Interactive UI
npm run test:unit:coverage  # With coverage (writes coverage/unit/)
```

Tests live next to the code as `*.test.ts` / `*.test.tsx` under `src/`. Vitest only picks up
`src/**/*.test.{ts,tsx}` — `e2e/*.spec.ts` belongs to Playwright and must never be matched.

Conventions:
- Import test helpers explicitly (`import { describe, it, expect } from 'vitest'`); globals are off.
- `src/test/setup.ts` registers jest-dom matchers and unmounts React trees between tests.
- Prefer unit tests for branching logic (error classification, parsers, formatters) and E2E for
  anything that depends on real rendering, routing, or the MCP proxy.

## E2E Tests

Automated Playwright tests provide regression protection for UI features.

### Running Tests

```bash
# Run all E2E tests (mock server starts/stops automatically)
npm run test:e2e

# Run with interactive UI (for debugging)
npm run test:e2e:ui

# Run in debug mode (step through tests)
npm run test:e2e:debug

# Install Playwright browsers (first time only)
npm run test:e2e:install

# Start mock server manually (for direct API testing)
docker compose -f e2e/docker-compose.yml up -d
```

The mock server (port 3001) is managed automatically by Playwright's `globalSetup`/`globalTeardown`. Tests require `DOT_AI_MCP_URL=http://localhost:3001` (set automatically by playwright.config.ts webServer).

### Adding New Tests

Use the `/generate-e2e-tests` skill to convert manual Playwright MCP verification into automated tests. The skill:
- Explores features using Playwright MCP
- Analyzes existing test coverage
- Proposes scenario-based tests (user journeys, not individual element checks)
- Implements and runs the tests

**Import `test`/`expect` from `./fixtures`, never from `@playwright/test`:**

```ts
import { test, expect } from './fixtures'
```

`e2e/fixtures.ts` wires in automatic coverage collection. A spec that imports `@playwright/test`
directly still passes — its coverage is just silently missing from the report.

### Long-Running Tests

Redirect test output to a file, then check tail for pass/fail:

```bash
mkdir -p ./tmp
npm run test:e2e > ./tmp/test-output.log 2>&1
tail -30 ./tmp/test-output.log  # Check result
# Read full file only if failures detected
```

**Temporary Files**: Always use `./tmp` for any temporary files, never `/tmp`.

### Test Structure

```text
e2e/
├── fixtures.ts             # Shared test/expect — adds coverage collection
├── helpers.ts              # Auth injection and login helpers
├── dashboard.spec.ts       # Dashboard page tests
├── oauth-login.spec.ts     # OAuth + token login flows
├── smoke.spec.ts           # Basic smoke tests
├── unified-search.spec.ts  # Search scopes, results, URL state
├── user-management.spec.ts # User CRUD journeys
└── docker-compose.yml      # Mock server config
```

## Test Coverage

Coverage is measured across three layers and merged into one report.

```bash
npm run test:coverage    # Everything: unit + E2E + merged report + threshold gate
npm run coverage:report  # Rebuild the merged report from existing data
npm run coverage:check   # Threshold gate only
npm run coverage:open    # Open the HTML report
npm run coverage:clean   # Delete coverage/

npm run test:unit:coverage  # Unit layer alone
npm run test:e2e:coverage   # E2E layers alone (instrumented Playwright run)
```

| Layer          | Source                       | How it's instrumented                              |
| -------------- | ---------------------------- | -------------------------------------------------- |
| `unit`         | Vitest                       | `@vitest/coverage-istanbul`                        |
| `e2e-frontend` | Playwright browser run       | `vite-plugin-istanbul`, harvested by `e2e/fixtures.ts` |
| `server`       | Express server under Node    | `NODE_V8_COVERAGE`, remapped to TS by `c8`          |

Instrumentation is gated on `COVERAGE=true`, so normal dev and production builds are untouched.

Output lands in `coverage/`: `combined/index.html` (browsable), `combined/lcov.info` (for external
services), `merged/combined.json` (the nyc input), and one raw directory per layer.

### Thresholds

`.nycrc.json` holds the gate, currently a few points under the measured baseline. It's a ratchet:
raise it as coverage grows, never lower it to turn a red build green. CI runs the gate in the
`E2E & Coverage` job and uploads `coverage/combined/` as an artifact either way.

### Why the merge is not a plain istanbul merge

Each layer instruments through a different pipeline (Vitest's SSR transform, Vite's client
transform, tsx + V8 remapping), so the same file gets different statement maps — `src/api/client.ts`
comes out as 48 statements in both frontend layers under entirely different keys. istanbul's own
merge matches counters by map key, so merging those silently reports wrong numbers instead of
failing. `scripts/coverage-report.mjs` therefore merges on original source **line numbers**, the one
key every layer agrees on (the same reason coverage services merge lcov line records):

- A file in a single layer keeps that layer's data exactly — all metrics precise.
- A file in several layers keeps the richest layer's maps, and other layers are credited by line.
  Precision is line-level for those files, and never inflated beyond what actually ran.

If per-file numbers ever look impossible (a well-tested file reading near 0%), suspect this and
check whether a new layer or instrumenter was added without matching handling.

### Gotchas

- Playwright SIGKILLs `webServer` processes by default, which discards V8 coverage and leaks the
  mock-server container. Both `webServer` entries set `gracefulShutdown`, and `server/index.ts`
  handles `SIGTERM`/`SIGINT` — don't remove either.
- Istanbul counters live in the page and reset on navigation. The fixture flushes on `beforeunload`
  and again at teardown, so multi-navigation tests are covered.
- E2E-derived coverage moves slightly between runs; that's why thresholds sit below the baseline.

## Project Structure

```
src/
├── api/           # API client for MCP visualization endpoint
├── components/    # React components
│   ├── renderers/ # Visualization renderers (Mermaid, Cards, Code, Table)
│   └── ...
├── pages/         # Route pages
├── types/         # TypeScript types
└── index.css      # Global styles + Prism theme
server/
└── index.ts       # Express backend proxy
```

## Key Files

- `src/types/visualization.ts` - Visualization response types
- `src/components/renderers/` - Core rendering components
- `src/pages/Visualization.tsx` - Main visualization page (`/v/{sessionId}`)
- `vitest.config.ts` - Unit test + unit coverage config
- `playwright.config.ts` - E2E config, mock server, coverage env
- `e2e/fixtures.ts` - Shared Playwright `test`/`expect` with coverage collection
- `scripts/coverage-report.mjs` - Merges the coverage layers into one report
- `.nycrc.json` - Coverage thresholds
