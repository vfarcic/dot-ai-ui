# PRD: Web UI Visualization Companion

**Issue**: [#2](https://github.com/vfarcic/dot-ai-ui/issues/2)
**Created**: 2025-12-31
**Status**: Ready for Implementation
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
- [ ] Users can open visualization URLs from Claude Code responses
- [ ] Visualizations render within 2 seconds of page load
- [ ] Multiple visualization types display correctly (mermaid, cards, code, table)
- [ ] Tab switching between visualizations is smooth and intuitive

### Technical Success
- [ ] Web UI successfully fetches data from `/api/v1/visualize/{sessionId}`
- [ ] Mermaid diagrams render client-side without errors
- [ ] Code blocks display with proper syntax highlighting
- [ ] Graceful error handling for expired/invalid sessions

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

**Error Response** (expired/invalid session):
```json
{
  "title": null,
  "visualizations": [],
  "insights": [],
  "error": "Session expired or not found"
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
- [ ] Update TypeScript types for new visualization format
- [ ] Create API client for `GET /api/v1/visualize/{sessionId}`
- [ ] Add environment variable for API base URL
- [ ] Handle error responses gracefully

**Success Criteria**: Can fetch visualization data from MCP endpoint

### Milestone 2: Core Renderers
- [ ] Implement MermaidRenderer component (mermaid.js integration)
- [ ] Implement CardRenderer component (grid of cards)
- [ ] Implement CodeRenderer component (syntax highlighting)
- [ ] Implement TableRenderer component
- [ ] Create VisualizationRenderer dispatcher (routes by type)

**Success Criteria**: Each visualization type renders correctly in isolation

### Milestone 3: Visualization Page
- [ ] Create `/v/{sessionId}` route
- [ ] Implement tab navigation for multiple visualizations
- [ ] Display title and insights panel
- [ ] Loading and error states
- [ ] Remove unused Chat page and related code

**Success Criteria**: Full visualization page works end-to-end with mock data

### Milestone 4: Integration & Polish
- [ ] Test with live MCP server
- [ ] Responsive design for different screen sizes
- [ ] Error handling for network failures, expired sessions
- [ ] Performance optimization (lazy loading mermaid.js)

**Success Criteria**: Production-ready visualization companion

### Milestone 5: Evaluate Future Enhancements
- [ ] Review usage patterns and user feedback
- [ ] Evaluate adding chat interface (reference PRD #1)
- [ ] Evaluate adding interactivity (click card → copy command to clipboard)
- [ ] Evaluate adding session history/bookmarks
- [ ] Decide on next iteration scope

**Success Criteria**: Clear decision on next phase of development

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
- [ ] `GET /api/v1/visualize/{sessionId}` endpoint implemented
- [ ] Tool responses include `visualizationUrl` field
- [ ] Web UI base URL configurable via environment variable

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

- **2025-12-31**: Initial PRD creation
  - Visualization-only approach (not chat interface)
  - URL-based access from Claude Code responses
  - Multiple visualization types: mermaid, cards, code, table
  - Client-side Mermaid rendering
  - Tabbed interface for multiple visualizations
  - Final milestone to evaluate future enhancements (including chat from PRD #1)
