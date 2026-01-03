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
