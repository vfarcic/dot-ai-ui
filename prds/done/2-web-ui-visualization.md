# PRD: Web UI Visualization Companion

**Issue**: [#2](https://github.com/vfarcic/dot-ai-ui/issues/2)
**Created**: 2025-12-31
**Status**: Complete
**Priority**: High

> *Supersedes the chat interface approach from [PRD #1](./done/1-web-ui-mcp-interaction.md), which has been closed.*

---

## Executive Summary

Create a lightweight Web UI that renders visualizations for MCP tool responses. The Web UI is a **visualization companion** to existing MCP clients (Claude Code, Cursor), not a replacement. Users continue chatting in their preferred MCP client, and can open URLs to see rich visual representations of data that text-based terminals cannot display.

**Key Technical Approach:**
- **Visualization-only**: No chat interface, no conversation state
- **URL-based access**: MCP responses include URLs; user opens in browser
- **Dedicated endpoint**: `GET /api/v1/visualize/{sessionId}` returns visualization data
- **Multiple visualization types**: Mermaid diagrams, cards, code blocks, tables
- **Client-side rendering**: Mermaid.js for diagrams, syntax highlighting for code
- **Tabbed interface**: Multiple visualizations displayed as switchable tabs

## Problem Statement

### Current State
- MCP server provides powerful Kubernetes AI capabilities through CLI clients (Claude Code, Cursor)
- These clients are text-only and cannot render rich visualizations
- Complex data (resource topology, deployment options, relationships) is hard to understand as text
- Users must mentally parse text descriptions of graphs, options, and code

### Pain Points
- **No Visual Context**: Resource relationships described in text are hard to visualize
- **Option Comparison**: Deployment options listed as text are harder to compare than visual cards
- **Code Readability**: YAML manifests without syntax highlighting are harder to read
- **Topology Understanding**: Kubernetes resource dependencies are naturally graph-shaped, not text-shaped

### What This PRD Does NOT Address
- Chat interface (deferred to future consideration)
- Replacing Claude Code/Cursor as primary interaction method
- Interactive workflows (clicking to select options)
- Authentication/authorization

## Success Criteria

### User Experience Success
- [x] Users can open visualization URLs from Claude Code responses
- [x] Visualizations render within 2 seconds of page load
- [x] Multiple visualization types display correctly (mermaid, cards, code, table)
- [x] Tab switching between visualizations is smooth and intuitive

### Technical Success
- [x] Web UI successfully fetches data from `/api/v1/visualize/{sessionId}`
- [x] Mermaid diagrams render client-side without errors
- [x] Code blocks display with proper syntax highlighting
- [x] Graceful error handling for expired/invalid sessions

## User Workflow

```
1. User in Claude Code: "show me resources in production namespace"

2. Claude Code calls MCP, receives response:
   "Here are the resources in production:
   - 3 Deployments
   - 5 Services
   - 2 ConfigMaps

   View visualization: https://ui.example.com/v/session-abc123"

3. User clicks/opens URL in browser

4. Web UI fetches: GET /api/v1/visualize/session-abc123

5. MCP returns visualization data

6. Web UI renders:
   - Tab 1: "Topology" - Mermaid diagram showing resource relationships
   - Tab 2: "Resources" - Cards showing each resource
   - Insights panel: AI-generated observations

7. User returns to Claude Code to continue conversation
```

## Technical Architecture

### High-Level Flow

```
[Claude Code] → [MCP Server] → Response includes visualizationUrl
                                        ↓
[User clicks URL] → [Web UI] → GET /api/v1/visualize/{sessionId}
                                        ↓
                               [MCP Server returns visualization data]
                                        ↓
                               [Web UI renders visualizations]
```

### API Contract

**Endpoint**: `GET /api/v1/visualize/{sessionId}`

**Response Format**:
```json
{
  "title": "Resources in production namespace",
  "visualizations": [
    {
      "id": "topology",
      "label": "Topology",
      "type": "mermaid",
      "content": "graph TD\n  A[Frontend] --> B[API Service]\n  B --> C[Database]"
    },
    {
      "id": "resources",
      "label": "Resources",
      "type": "cards",
      "content": [
        { "id": "deploy-1", "title": "frontend", "description": "Deployment", "tags": ["Running", "3 replicas"] },
        { "id": "deploy-2", "title": "api", "description": "Deployment", "tags": ["Running", "2 replicas"] }
      ]
    },
    {
      "id": "manifest",
      "label": "Manifest",
      "type": "code",
      "content": { "language": "yaml", "code": "apiVersion: apps/v1\nkind: Deployment..." }
    }
  ],
  "insights": [
    "Frontend depends on api-svc via API_URL environment variable",
    "2 pods showing high restart counts in the last hour"
  ],
  "error": null
}
```

**Error Response** (HTTP 404 - expired/invalid session):
```json
{
  "error": "Session not found"
}
```

### Visualization Types

| Type | Content Format | Renderer | Use Case |
|------|----------------|----------|----------|
| `mermaid` | `string` (Mermaid syntax) | mermaid.js | Topology, flowcharts, relationships |
| `cards` | `Card[]` | Card grid component | Options, resources, patterns |
| `code` | `{ language: string, code: string }` | Syntax highlighter | Manifests, commands, configs |
| `table` | `{ headers: string[], rows: string[][] }` | HTML table | Tabular data, comparisons |

**Card Interface**:
```typescript
interface Card {
  id: string
  title: string
  description?: string
  tags?: string[]
}
```

### Technology Stack

**Frontend**
- **Framework**: React with Vite (already set up)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 (already set up)
- **Diagram Rendering**: mermaid.js
- **Syntax Highlighting**: Prism.js or highlight.js
- **HTTP Client**: Fetch API

**Dependencies on MCP Server (dot-ai repo)**
- `GET /api/v1/visualize/{sessionId}` endpoint
- `visualizationUrl` field in tool responses
- Configurable Web UI base URL

## Implementation Milestones

### Milestone 1: API Client & Types
- [x] Update TypeScript types for new visualization format
- [x] Create API client for `GET /api/v1/visualize/{sessionId}`
- [x] Add environment variable for API base URL
- [x] Handle error responses gracefully

**Success Criteria**: Can fetch visualization data from MCP endpoint

### Milestone 2: Core Renderers
- [x] Implement MermaidRenderer component (mermaid.js integration)
- [x] Implement CardRenderer component (grid of cards)
- [x] Implement CodeRenderer component (syntax highlighting)
- [x] Implement TableRenderer component
- [x] Create VisualizationRenderer dispatcher (routes by type)

**Success Criteria**: Each visualization type renders correctly in isolation

### Milestone 3: Visualization Page
- [x] Create `/v/{sessionId}` route
- [x] Implement tab navigation for multiple visualizations
- [x] Display title and insights panel
- [x] Loading and error states
- [x] Remove unused Chat page and related code

**Success Criteria**: Full visualization page works end-to-end with mock data

### Milestone 4: Integration & Polish
- [x] Test with live MCP server
- [x] Responsive design for different screen sizes
- [x] Error handling for network failures, expired sessions
- [~] Performance optimization (lazy loading mermaid.js) - Deferred: marginal benefit, library needed immediately
- [x] Enhanced loading state (spinner/skeleton instead of text)
- [x] Visual design polish (consistent styling, spacing, colors)

**Success Criteria**: Production-ready visualization companion

### Milestone 5: Evaluate Future Enhancements (Deferred)
- [~] Review usage patterns and user feedback - Deferred: requires real-world usage data
- [~] Evaluate adding chat interface (reference PRD #1) - Deferred: requires user feedback
- [~] Evaluate adding interactivity (click card → copy command to clipboard) - Deferred: requires user feedback
- [~] Evaluate adding session history/bookmarks - Deferred: requires user feedback
- [~] Decide on next iteration scope - Deferred: requires usage patterns

**Success Criteria**: Clear decision on next phase of development (deferred until usage data available)

### Milestone 6: Production Deployment
- [x] Create Dockerfile for production build
- [x] Create Helm chart (following dot-ai patterns)
  - [x] Chart.yaml with metadata
  - [x] values.yaml with configurable options (image, ingress/gateway, resources)
  - [x] Deployment template
  - [x] Service template
  - [x] Ingress/HTTPRoute templates (optional)
- [x] Set up GitHub Actions CI pipeline
  - [x] Build and test on PR
  - [x] Auto-version bump on main merge
  - [x] Build and push Docker image to GHCR
  - [x] Package and push Helm chart to GHCR OCI registry
  - [x] Create GitHub release with artifacts
- [x] Documentation for installation via Helm

**Success Criteria**: Users can deploy Web UI with `helm install dot-ai-ui oci://ghcr.io/vfarcic/dot-ai-ui/charts/dot-ai-ui`

## Technical Considerations

### Performance
- **Mermaid.js**: ~500KB library, should be lazy-loaded
- **Initial Load**: Target < 2 second time-to-interactive
- **Rendering**: Mermaid diagrams can be slow for large graphs; may need size limits

### Security
- **Session IDs in URLs**: Accept risk for internal tooling; sessions are short-lived
- **No sensitive data**: Visualizations show structure, not secrets
- **CORS**: MCP server must allow requests from Web UI domain

### Error Handling
- **Expired session**: Show friendly message, suggest returning to Claude Code
- **Invalid session**: Same as expired
- **Network error**: Retry button, clear error message
- **Malformed response**: Graceful degradation, show what we can

## Dependencies

### MCP Server (dot-ai repo)
- [x] `GET /api/v1/visualize/{sessionId}` endpoint implemented (PR #319)
- [x] Tool responses include `visualizationUrl` field (PR #319)
- [x] Web UI base URL configurable via `WEB_UI_BASE_URL` env var (PR #319)

### External Libraries
- mermaid.js - Diagram rendering
- Prism.js or highlight.js - Syntax highlighting

## Out of Scope

Items explicitly not included in this PRD:
- Chat interface (see PRD #1 for deferred approach)
- User authentication
- Interactive visualizations (clicking to select options)
- Persistent session history
- Mobile-specific optimizations

## Related Documents

- [PRD #1: Web UI for MCP Server Interaction](./1-web-ui-mcp-interaction.md) - Deferred chat interface approach
- [MCP Tools Overview](https://devopstoolkit.ai/docs/mcp/guides/mcp-tools-overview) - Available MCP tools

---

## Change Log

- **2025-12-31**: PRD Complete - Milestone 5 deferred
  - All implementation milestones (1-4) complete
  - Production deployment (Milestone 6) complete
  - Milestone 5 (Evaluate Future Enhancements) deferred until real-world usage data available
  - Success criteria marked complete - all technical requirements implemented and verified
  - PRD status changed to Complete

- **2025-12-31**: Enhanced loading state and tab auto-selection fix
  - Created LoadingSpinner component with animated spinner and messaging for long waits
  - Fixed tab auto-selection bug - first tab now selected automatically on load
  - Deferred lazy loading optimization (marginal benefit, library needed immediately)
  - Milestone 4 now complete (all implementation items done, 1 deferred)

- **2025-12-31**: Milestone 6 complete - Documentation for Helm installation
  - Created minimal README.md following dot-ai documentation pattern
  - Links to https://devopstoolkit.ai/docs/ui/ for detailed documentation
  - Created docs/setup/kubernetes-setup.md with comprehensive Helm installation guide
  - Covers: Quick Start, Configuration Reference, Existing Secrets, TLS, Gateway API
  - Added LICENSE (MIT) file
  - Milestone 6 (Production Deployment) is now 100% complete

- **2025-12-31**: Responsive design complete - Milestone 4 progress
  - Updated Layout component with responsive padding (px-3 sm:px-4 md:px-6), smaller logo/text on mobile
  - Updated MermaidRenderer with flex-wrap controls, hidden hint on mobile, responsive viewport (min-h-[250px] sm:min-h-[400px])
  - Updated Home page with responsive icon, text sizes, and spacing
  - Updated Visualization page with responsive title sizing
  - Verified with Playwright at mobile (375px), tablet (768px), and desktop (1280px) viewports

- **2025-12-31**: GitHub Actions CI pipeline complete - Milestone 6 progress
  - Created `.github/workflows/ci.yml` with 4 jobs: test, security, version, release
  - PR triggers: lint, build, CodeQL security analysis, npm audit
  - Main merge triggers: version bump from git tags, Docker multi-arch build/push, Helm chart package/push
  - Creates coordinated GitHub release with Docker image + Helm chart artifacts
  - Created `.github/release.yml` for auto-generated release notes categorization
  - Required secret: `GHCR_TOKEN` for package publishing

- **2025-12-31**: Helm chart complete - Milestone 6 progress
  - Created Helm chart at `charts/` following dot-ai patterns
  - Chart.yaml with metadata (name, version, maintainers, keywords)
  - values.yaml with configurable options: image, resources, dotAi connection, ingress, gateway
  - Templates: deployment, service, ingress (optional), httproute (optional), gateway (optional), secret
  - Supports both traditional Ingress and Gateway API
  - Auth token configurable via existing secret or chart-created secret
  - Validated with `helm template` and `helm lint`

- **2025-12-31**: Dockerfile for production build - Milestone 6 progress
  - Created multi-stage Dockerfile (builder → runtime) with Node.js 24 Alpine
  - Compiles frontend via Vite and server TypeScript separately
  - Runs as non-root user (UID 10001) for security
  - Configurable via environment variables: PORT, DOT_AI_MCP_URL, DOT_AI_AUTH_TOKEN
  - Created .dockerignore for optimized build context
  - Validated with successful build, container run, and Playwright UI testing
  - Image size: ~620MB (due to node_modules for Express/React)

- **2025-12-31**: Error handling and home page - Milestone 4 progress
  - Implemented ErrorDisplay component with contextual error types (session-expired, network, timeout, server, ai-unavailable)
  - Added retry functionality for recoverable errors
  - Made error messages agent-agnostic (works with any MCP client, not just Claude Code)
  - Created Home page explaining site purpose with link to devopstoolkit.ai docs
  - Made header logo/title clickable link to home page
  - Added cursor-pointer to all interactive elements (tabs, buttons, insights panel)
  - Verified error handling with Playwright testing

- **2025-12-31**: Visual design polish complete - Milestone 4 progress
  - Updated color theme to match devopstoolkit.ai brand (yellow #FACB00, dark #2D2D2D/#1a1a1a)
  - Added logo from dot-ai-website with correct aspect ratio
  - Minimized header to maximize visualization space
  - Removed max-width constraint for full-width layouts
  - Implemented horizontal scrolling tabs with yellow clickable indicators (‹ ›)
  - Updated Mermaid diagram theme to use brand colors with readable text

- **2025-12-31**: Added Milestone 6 - Production Deployment
  - Decision: Add Helm chart and CI/CD pipeline for releasing Web UI
  - New tasks: Dockerfile, Helm chart (following dot-ai patterns), GitHub Actions CI
  - Enables deployment via `helm install dot-ai-ui oci://ghcr.io/vfarcic/dot-ai-ui/charts/dot-ai-ui`

- **2025-12-31**: Milestone 3 complete - Visualization Page
  - Added collapsible InsightsPanel component with session ID and AI insights
  - Panel starts collapsed by default to maximize diagram space
  - Title displayed prominently at top of page
  - All Milestone 3 items now complete

- **2025-12-31**: Milestone 2 complete - Core Renderers with zoom/pan
  - Implemented all 4 renderer components: MermaidRenderer, CardRenderer, CodeRenderer, TableRenderer
  - Created VisualizationRenderer dispatcher for type-based routing
  - Added mermaid.js and prismjs dependencies
  - Enhanced MermaidRenderer with zoom controls (25%-300%), pan (drag), and fullscreen mode
  - Added Prism.js dark theme CSS for syntax highlighting
  - Integrated renderers into Visualization page
  - Verified with Playwright testing against live MCP server
  - Created CLAUDE.md with Playwright testing requirements

- **2025-12-31**: Milestone 3 progress - Tab navigation and backend proxy
  - Implemented TabContainer component for switching between visualizations
  - Added Express backend proxy for secure MCP authentication (token stays server-side)
  - Implemented loading and error states with appropriate UI feedback
  - Configured environment variables: `DOT_AI_MCP_URL`, `DOT_AI_AUTH_TOKEN`
  - Adapted API client to handle MCP response wrapper (`{ success, data, meta }`)
  - Increased API timeout to 5 minutes for AI generation
  - Verified end-to-end flow with live MCP server

- **2025-12-31**: Initial PRD creation
  - Visualization-only approach (not chat interface)
  - URL-based access from Claude Code responses
  - Multiple visualization types: mermaid, cards, code, table
  - Client-side Mermaid rendering
  - Tabbed interface for multiple visualizations
  - Final milestone to evaluate future enhancements (including chat from PRD #1)
