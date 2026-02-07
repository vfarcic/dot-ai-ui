# PRD #16: Unified Search with Knowledge Base Integration

**GitHub Issue**: [#16](https://github.com/vfarcic/dot-ai-ui/issues/16)
**Status**: Done
**Priority**: High
**Created**: 2026-02-06

## Problem Statement

Users cannot access the Knowledge Base (organizational documentation Q&A) from the web UI. The current resource search fires on every keystroke, sending unnecessary semantic search requests to the MCP server. These are two separate issues that a unified search redesign addresses together.

## Solution Overview

Rework the header search into a unified search with:
- Scope toggle: Resources | Knowledge | Both (default)
- Enter-to-submit with visible submit button (no debounce)
- Reordered header: Namespace selector before search (natural left-to-right workflow)
- Knowledge answers displayed above resource results
- AI-synthesized answers with source provenance and collapsible raw chunks

## Success Criteria

- [x] Unified search input with scope toggle (Both/Resources/Knowledge)
- [x] Enter-to-submit replaces debounced search
- [x] Submit button visible for discoverability
- [x] Header reordered: Logo → Namespace → Search
- [x] Knowledge Base answers rendered with Markdown, source links, collapsible chunks
- [x] Independent loading states for knowledge and resource sections
- [x] URL params support bookmarking (q, scope, ns)
- [x] Express proxy route for POST /api/v1/knowledge/ask
- [x] E2E tests covering unified search behavior
- [x] Mock server search fixture wired up for resource search

## User Impact

**Target Users**: Developers and operators using the dashboard to understand their cluster and organizational documentation.

**User Journey**:
1. User sees scope toggle (Both/Resources/Knowledge) and search input in header
2. User selects scope, types a question, presses Enter or clicks submit
3. Knowledge answer appears at top with AI-synthesized response, source links, and optional raw chunks
4. Resource results appear below (when scope includes resources)
5. URL is bookmarkable for sharing

## Technical Details

### API Contract

`POST /api/v1/knowledge/ask` — proxied through Express to MCP server with 5-minute timeout.

### Files Changed

| File | Change |
|------|--------|
| `server/index.ts` | Added POST /api/v1/knowledge/ask proxy route |
| `src/api/knowledge.ts` | New API client with types and askKnowledge() |
| `src/components/dashboard/SharedDashboardLayout.tsx` | Added searchScope to context, reordered header |
| `src/components/dashboard/SearchInput.tsx` | Removed debounce, added scope toggle + submit button |
| `src/components/dashboard/KnowledgeResultsView.tsx` | New component for knowledge answers |
| `src/components/dashboard/DashboardHome.tsx` | Conditional rendering based on scope |
| `src/components/dashboard/NamespaceSelector.tsx` | Removed redundant "Namespace:" label |
| `e2e/docker-compose.yml` | Added pull_policy: always |
| `e2e/unified-search.spec.ts` | New E2E tests for unified search (21 tests) |
| `e2e/dashboard.spec.ts` | Fixed namespace dropdown locator after label removal |

### Dependencies Added

- `react-markdown` — Rendering AI-synthesized answers

## Milestones

- [x] Core unified search UI (scope toggle, submit button, header reorder)
- [x] Knowledge Base API client and Express proxy
- [x] KnowledgeResultsView component (answer, sources, chunks)
- [x] Integration in DashboardHome with scope-based rendering
- [x] Visual verification with Playwright MCP
- [x] E2E test coverage for unified search
- [x] Mock server resource search fixture
