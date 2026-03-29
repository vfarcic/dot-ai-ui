# PRD #20: Remediation Sessions Control Center

**GitHub Issue**: [#20](https://github.com/vfarcic/dot-ai-ui/issues/20)
**Status**: Draft
**Priority**: High
**Created**: 2026-03-29

## Problem Statement

Users can only view a remediation session if they already know the session ID. There is no way to discover active or past sessions, monitor their progress in real-time, or act on pending remediations from a central location. This forces users to track session IDs manually and navigate to individual session pages one at a time.

## Solution Overview

A real-time control center dashboard at `/remediations` that:
- Lists all remediation sessions as expandable panels with full analysis details
- Receives live updates via SSE streaming (new sessions appear, statuses update in-place)
- Supports inline execution of pending remediations without leaving the page
- Provides status filtering for triage workflows
- Offers a copy-to-clipboard option for users who prefer fixing issues manually via external agents (Claude Code, Cursor, etc.)

## Success Criteria

- [ ] Users can discover all remediation sessions without knowing session IDs
- [ ] New sessions and status changes appear in real-time via SSE
- [ ] Full analysis is viewable inline (root cause, confidence, contributing factors, recommended actions)
- [ ] Users can approve and execute remediations directly from the control center
- [ ] Execution results display inline after completion
- [ ] Status filtering works correctly for all 5 statuses

## User Impact

**Target Users**: Platform engineers and SREs monitoring Kubernetes cluster remediation activity

**User Journey**:
1. User navigates to `/remediations` from the sidebar
2. Dashboard loads existing sessions and connects to SSE for live updates
3. User sees a list of session panels with status badges and issue summaries
4. User expands a panel to see the full analysis (root cause, confidence, recommended actions)
5. For sessions awaiting approval, user clicks "Execute" to run the remediation inline
6. Results appear in the same panel — user stays on the control center throughout
7. New sessions from other tools/users appear live at the top of the list

## Technical Scope

### New MCP Endpoints (already implemented server-side)

1. **`GET /api/v1/sessions`** — List sessions with filtering and pagination
   - Query params: `status` (optional), `limit` (default 50, max 200), `offset` (default 0)
   - Returns: sessionId, status, issue, mode, toolName, createdAt, updatedAt
   - Statuses: `investigating`, `analysis_complete`, `failed`, `executed_successfully`, `executed_with_errors`

2. **`GET /api/v1/events/remediations`** — SSE stream for session lifecycle events
   - Event types: `session-created`, `session-updated`
   - 30-second heartbeat

### UI Architecture

**Control center page** with stacked expandable session panels:
- Header row (always visible): status badge, issue summary, relative timestamp
- Expanded content: full analysis via `InfoRenderer`, action/result panels
- Reuses existing components: `InfoRenderer`, `ActionsPanel`, `ResultsPanel`

**SSE client** using `fetch()` + `ReadableStream` (not `EventSource`, which doesn't support auth headers)

**Backend proxy** in Express for both REST list and SSE streaming endpoints

### Reusable Components

| Component | Purpose |
|-----------|---------|
| `InfoRenderer` + `REMEDIATE_TEMPLATE` | Render full analysis inline |
| `ActionsPanel` | Execute button for pending sessions |
| `ResultsPanel` | Execution results display |
| `getRemediateSession()` | Fetch full session detail on expand |
| `executeRemediation()` | Inline execution |

## Integration Points

- **MCP Server**: Two new REST endpoints (sessions list + SSE stream) proxied through Express
- **Existing Visualization Page**: Session detail still accessible at `/v/:sessionId` but control center is the primary interface
- **Sidebar Navigation**: New "Remediations" link gated behind `isToolAllowed('remediate')`

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| SSE connection drops silently | Medium | Auto-reconnect with backoff; 30s heartbeat detects dead connections |
| Race condition between initial fetch and SSE | Low | Connect SSE first, then fetch list; duplicate events are idempotent (update in-place by sessionId) |
| Large number of sessions degrades performance | Medium | Pagination via limit/offset; collapsed panels are lightweight |
| `EventSource` doesn't support auth headers | High | Use `fetch()` + `ReadableStream` for SSE parsing instead |

## Milestones

### Milestone 1: Backend Proxy Endpoints
- [ ] REST proxy for `GET /api/v1/sessions` with query param forwarding
- [ ] SSE streaming proxy for `GET /api/v1/events/remediations` with proper pipe-through
- [ ] Both endpoints authenticated and registered before existing `:sessionId` route

### Milestone 2: API Client and Types
- [ ] TypeScript types for session summaries, statuses, and SSE events
- [ ] REST client function for fetching session list
- [ ] SSE subscription function with auto-reconnect and cleanup

### Milestone 3: Control Center Page — List and Real-Time Updates
- [ ] Page component with expandable session panels
- [ ] Status filter dropdown
- [ ] SSE integration: new sessions prepend, statuses update in-place
- [ ] Route registered and sidebar navigation link added

### Milestone 4: Inline Analysis and Execution
- [ ] Expanded panels show full analysis via `InfoRenderer` with `REMEDIATE_TEMPLATE`
- [ ] `ActionsPanel` for pending sessions with inline execution
- [ ] `ResultsPanel` displays results after execution
- [ ] Tool access gating via `isToolAllowed('remediate')`

### Milestone 5: Polish and Verification
- [ ] Loading and error states
- [ ] SSE reconnection handling
- [ ] Playwright verification of rendering and interactions
- [ ] E2E test coverage

## Dependencies

- MCP server endpoints `GET /api/v1/sessions` and `GET /api/v1/events/remediations` (PRD #425, already implemented)
- Existing `InfoRenderer`, `ActionsPanel`, `ResultsPanel` components

## Out of Scope

- Copy-to-clipboard for external agents (deferred to follow-up PRD discussion)
- Session search/full-text filtering
- Multi-session bulk actions
- Session deletion or archival

## Open Questions

1. What format should the copy-to-clipboard content use for external agent workflows?
2. Should the control center auto-expand newly arriving sessions, or keep them collapsed?
3. Is pagination sufficient, or should we add infinite scroll?
