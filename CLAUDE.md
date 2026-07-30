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
├── dashboard.spec.ts  # Dashboard page tests
├── smoke.spec.ts      # Basic smoke tests
└── docker-compose.yml # Mock server config
```

## Momentic E2E Tests

A second, AI-driven E2E suite lives in `momentic/`. Where the Playwright specs pin
down exact selectors, these describe intent in natural language and let Momentic's
AI agents resolve targets and evaluate assertions — so they survive markup churn
but cost an API call per step (~30-90s per test).

```bash
# 1. Start the deterministic stack (mock MCP on :3001, app on :3002). Leave running.
npm run test:momentic:stack

# 2. In another terminal — run the suite (a path arg is required, else the CLI prompts)
npm run test:momentic

# Validate YAML schema + file references without running anything
npm run test:momentic:lint

# Interactive authoring/debugging UI
npm run test:momentic:app
```

Config is `momentic.config.yaml`; the `local` environment sets `baseUrl`
(`http://localhost:3002`) and `ACCESS_TOKEN`. Requires a Momentic login
(`npx momentic login`) — verify setup with `npx momentic doctor`.

### Test Structure

```text
momentic/
├── modules/login-with-token.module.yaml  # Shared sign-in flow
├── authentication-token-login.test.yaml  # Valid token → dashboard
├── authentication-invalid-token.test.yaml# Invalid token rejected
├── resource-explorer.test.yaml           # Sidebar, namespace scope, detail tabs
├── unified-search.test.yaml              # Search scopes, relevance, clear
├── user-management.test.yaml             # User list + create/delete controls
├── visualization-session.test.yaml       # /v/{sessionId} diagram + insights
└── ai-action-bar.test.yaml               # Tool selection + submit gating
```

Files are Momentic v2 YAML (`fileType: momentic/test/v2`) and are meant to be
edited directly; run `npm run test:momentic:lint` after changes. Test `id` values
must stay stable — they key Momentic's step cache.

### Known mock-server gaps

Two things are deliberately *not* asserted, because the mock cannot satisfy them.
Both are noted inline in the tests; tighten them when the fixtures land:

- **Namespace filtering** — `GET /api/v1/resources` ignores `namespace`, returning
  pods from every namespace. The UI does send the filter, so this is a fixture gap,
  not a UI bug. Tests assert re-scoping (URL + dropped Namespace column) only.
- **AI tool execution** — `POST /api/v1/tools/:toolName` answers `NOT_IMPLEMENTED`
  for query/remediate/operate, so `ai-action-bar.test.yaml` covers tool selection
  and submit gating but never submits an intent.

Writing assertions: state only what is observable on screen. Adding a *reason*
clause ("…because every row is now in one namespace") can make an otherwise-true
assertion fail when the AI can see something that contradicts the rationale.

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
