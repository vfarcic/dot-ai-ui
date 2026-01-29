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
# Start mock server (provides deterministic test data)
docker compose -f e2e/docker-compose.yml up -d

# Run all E2E tests
npm run test:e2e

# Run with interactive UI (for debugging)
npm run test:e2e:ui

# Run in debug mode (step through tests)
npm run test:e2e:debug
```

The mock server runs on port 3001. Tests require `DOT_AI_MCP_URL=http://localhost:3001` (set automatically by playwright.config.ts webServer).

### Adding New Tests

Use the `/generate-e2e-tests` skill to convert manual Playwright MCP verification into automated tests. The skill:
- Explores features using Playwright MCP
- Analyzes existing test coverage
- Proposes scenario-based tests (user journeys, not individual element checks)
- Implements and runs the tests

### Test Structure

```
e2e/
├── dashboard.spec.ts  # Dashboard page tests
├── smoke.spec.ts      # Basic smoke tests
└── docker-compose.yml # Mock server config
```

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
