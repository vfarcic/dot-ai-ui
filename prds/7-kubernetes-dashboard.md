# PRD: Kubernetes Dashboard with AI Enhancement

**Issue**: [#7](https://github.com/vfarcic/dot-ai-ui/issues/7)
**Status**: Draft
**Priority**: High
**Created**: 2025-01-08

---

## Problem Statement

Existing Kubernetes dashboards (like the official Kubernetes Dashboard, now archived) provide basic resource visibility but lack AI-powered insights and remediation capabilities. Users must:

1. Switch between dashboard views and separate AI tools to troubleshoot issues
2. Manually correlate resource states with potential problems
3. Copy/paste resource information into AI tools for analysis
4. Lack real-time AI-powered recommendations for cluster operations

Platform engineers, developers, and SRE teams need a unified experience that combines traditional Kubernetes resource management with AI-powered operations.

---

## Solution Overview

Create a Kubernetes dashboard within dot-ai-ui that:

1. **Lists and describes ANY Kubernetes resource** (including Custom Resources) via a **hybrid data architecture**:
   - **Resource discovery & metadata**: From Qdrant database via new MCP endpoints
   - **Live status data**: From Kubernetes API for real-time status (pod phase, replica counts, conditions)
2. **Integrates AI-powered actions** via MCP tools:
   - **Query**: Natural language questions about resources
   - **Remediate**: AI-powered issue analysis and fix suggestions
   - **Operate**: Day 2 operations (scale, update, rollback)
   - **Recommend**: Deployment recommendations

### Key Differentiators

- **Generic Resource Support**: Automatically discovers and displays ALL resource types from Qdrant's indexed data, including CRDs - no code changes needed for new resource types
- **AI-First Actions**: Every resource detail view includes AI action buttons
- **Unified Experience**: Traditional dashboard + AI capabilities in one interface
- **Hybrid Data Architecture**: Leverages Qdrant for fast resource discovery while maintaining real-time status from K8s API

---

## User Journey

### Primary Flow: Troubleshooting a Failing Pod

1. User navigates to `/dashboard`
2. Selects namespace from dropdown
3. Clicks "Pods" in sidebar → sees list with status indicators
4. Notices a pod in `CrashLoopBackOff` state
5. Clicks pod name → detail view with Overview, YAML, Events, Logs tabs
6. Clicks **"Remediate"** button
7. AI analyzes pod events, logs, and related resources
8. Results appear in side panel with root cause and suggested fixes
9. User can execute suggested commands or view full visualization

### Secondary Flow: Exploring Custom Resources

1. User has Argo CD installed with Application CRDs
2. Dashboard automatically discovers `argoproj.io/v1alpha1/Application` resources
3. User clicks "argoproj.io" section in sidebar
4. Selects "Applications" → sees all Argo Applications
5. Clicks on an Application → detail view with YAML, events
6. Clicks **"Ask AI"** → "Why is this Application out of sync?"
7. AI provides analysis based on Application status and Git state

---

## Technical Approach

### Architecture

```
Frontend (React)                    Backend (Express)
+-------------------+              +-------------------+
| Dashboard Pages   |   HTTP       | /api/v1/mcp/*     |---> MCP Server ---> Qdrant
| - Generic Lists   |------------->| /api/k8s/status/* |---> Kubernetes API (status only)
| - AI Action Btns  |              +-------------------+
+-------------------+

Key: Hybrid approach - Qdrant for discovery/metadata, K8s API for live status
```

### Data Sources

| Feature | Source | Method |
|---------|--------|--------|
| Resource kinds discovery | MCP Server | New `listResourceKinds` tool → Qdrant |
| Resource list (metadata) | MCP Server | New `listResources` tool → Qdrant |
| Namespace list | MCP Server | New `listNamespaces` tool → Qdrant |
| Live status (pod phase, replicas) | MCP Server | Via `/api/v1/resource` endpoint (MCP queries K8s API) |
| AI Query/Remediate/Operate | MCP Server | Existing proxy pattern |

### New MCP Endpoints Required (in dot-ai)

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `listResourceKinds` | Populate sidebar | `{ kinds: [{ kind, apiGroup, apiVersion, count }] }` |
| `listResources` | Resource tables | `{ resources: [{ name, namespace, kind, labels, createdAt }], total }` |
| `listNamespaces` | Namespace dropdown | `{ namespaces: ["default", "kube-system", ...] }` |

### Key Technical Decisions

1. **Hybrid Data Architecture**: Use Qdrant for resource discovery (via MCP), K8s API only for live status
2. **Why Hybrid**: Qdrant data is synced by dot-ai-controller; status changes frequently and would cause heavy sync traffic if stored
3. **State Management**: React Query for server state (caching, polling)
4. **Routing**: Generic routes like `/dashboard/:group/:version/:kind`
5. **Status Enrichment**: Fetch status from K8s API only for resources currently displayed (not all resources)

---

## Success Criteria

1. **Resource Discovery**: Dashboard displays ALL resource types available in the cluster, including CRDs
2. **AI Integration**: Users can trigger Remediate/Query/Operate actions from any resource detail view
3. **Performance**: Resource lists load within 2 seconds, AI actions complete within MCP timeout
4. **Usability**: Users can navigate from problem identification to AI-assisted resolution without leaving the dashboard

---

## Milestones

### Milestone 0: Mock UI Prototype (COMPLETED)
- [x] Dashboard layout with collapsible sidebar
- [x] Namespace selector component (visual)
- [x] Resource type grouping in sidebar (Workloads, Network, Config, Custom Resources)
- [x] Resource list table with status badges
- [x] Mock data for Pods, Deployments, Services, ConfigMaps, Argo Applications

**Validation**: Navigate to `/dashboard`, see mock UI with hard-coded data

### Milestone 1: MCP Integration (Resource Discovery) - COMPLETED
- [x] MCP client functions for `listResourceKinds` endpoint
- [x] MCP client functions for `listResources` endpoint
- [x] Replace mock data with MCP queries (resource list)
- [x] Dynamic sidebar populated from `listResourceKinds`
- [x] Resource tables populated from `listResources`

**Validation**: Dashboard shows real resources from Qdrant via MCP

**Dependency**: Requires dot-ai MCP to implement the new endpoints first

### Milestone 2: Live Data via MCP (COMPLETED)
- [x] Single resource endpoint (`/api/v1/resource`) returns live K8s data (metadata, spec, status)
- [x] Events endpoint (`/api/v1/events`) fetches live events from K8s API
- [x] Pod logs endpoint (`/api/v1/logs`) streams logs from K8s API
- [x] List endpoint supports `includeStatus` param for live status enrichment

**Validation**: Detail views show live status, events, and logs from K8s API via MCP

**Architecture Note**: Original plan assumed UI would use `@kubernetes/client-node` directly. Actual implementation: MCP server handles all K8s API communication; UI only talks to MCP.

### Milestone 3: Frontend Infrastructure
- [ ] React Query setup for data fetching
- [ ] Namespace context provider
- [ ] Generic resource hooks with polling
- [ ] Caching strategy for MCP data vs K8s status data

**Validation**: Hooks successfully fetch, cache, and merge data from both sources

### Milestone 4: Resource List & Detail Views
- [x] Generic `ResourceListPage` with dynamic columns
- [x] Status badges and age formatting
- [x] `ResourceDetailPage` connected to real MCP API
- [x] Resource header with description from MCP capabilities
- [x] Overview tab with real printer column data
- [x] Metadata tab with real resource metadata
- [x] Spec tab with real resource spec
- [x] Status tab with real resource status
- [x] YAML tab with syntax highlighting and copy-to-clipboard
- [x] Events tab with lazy loading and URL state persistence
- [x] Pod-specific Logs tab with container selector, Tail polling, and auto-scroll

**Validation**: Can list and view details of any resource type (Pods, Deployments, CRDs)

### Milestone 5: AI Action Integration

#### Design Decisions (Resolved)

**Query Tool - Dashboard Home (First Priority)**
- [x] Design: Query tool for dashboard home - "Analyze Cluster Health" button replaces empty body
- Decision: No auto-trigger (avoids unexpected token costs); explicit button click required
- Decision: Query analyzes entire cluster (not namespace-scoped); namespace-specific queries deferred
- Decision: Results rendered inline using existing visualization components (no navigation to `/v/{sessionId}`)
- Decision: Reuse `LoadingSpinner`, `VisualizationRenderer`, `TabContainer`, `ErrorDisplay` from visualization page
- New code needed: ~60-90 lines (dashboard home orchestration + API client function)

**Unified Layout Architecture**
- [x] Design: Merge visualization page and dashboard into shared layout
- [x] Implementation: SharedDashboardLayout component with collapsible sidebar
- Decision: Keep separate routes (`/v/{sessionId}` and `/dashboard/*`) but share sidebar layout
- Decision: Sidebar collapsed by default for visualization, expanded for resource views
- Decision: Sidebar state preserved via `sb` URL parameter (`sb=1` collapsed, `sb=0` expanded)
- Decision: After "Analyze Cluster Health" completes, navigate to `/v/{sessionId}?sb=0|1` for URL caching
- MCP requirement: Query tool visualization mode (`[visualization]` prefix) returns `sessionId` in response

**Enhanced Visualizations (Agreed Design)**

*Problem Indication - AI-driven styling*
- [x] Design: AI indicates problems via native styling (no additional UI metadata parsing)
- Decision: Mermaid - AI uses `style NodeId fill:#ef4444,stroke:#dc2626` for error nodes
- Decision: Cards/Tables - AI adds `status: 'error' | 'warning' | 'ok'` field, UI renders with appropriate colors/icons
- Decision: Fully AI-driven approach keeps UI simple and gives flexibility
- MCP requirement: Update prompts to instruct AI to use red styling in Mermaid for problems, add status field guidance

*Bar Charts for Resource Metrics*
- [x] Design: Add bar charts as new visualization type for resource usage
- Decision: Start with ONE chart type (bar chart) - prove it works before adding others
- Decision: Use case is resource metrics (used vs available memory, CPU across nodes/namespaces)
- Decision: Schema: `{ type: 'bar-chart', title, data: [{label, value, max?, status?}], unit?, orientation? }`
- Decision: `status` field per bar enables color-coding (ties into problem indication)
- UI implementation needed: BarChartRenderer component
- MCP implementation needed: Add bar-chart as new visualization type

**Other Tools (To Be Designed)**
- [ ] Design: Remediate tool integration - how to present analysis and suggested fixes?
- [ ] Design: Operate tool integration - what Day 2 operations to expose (scale, update, rollback)?
- [ ] Design: Recommend tool integration - when/where to show deployment recommendations?
- [ ] Design: Capabilities tool integration - how to display cluster resource capabilities and operators?

#### Implementation
- [x] Shared `SharedDashboardLayout` component with collapsible sidebar (completed)
- [x] Dashboard home with "Analyze Cluster Health" button (completed)
- [x] API client for Query tool (`src/api/query.ts`) with `[visualization]` prefix (completed)
- [x] Visualization page uses shared layout with sidebar collapsed by default (completed)
- [x] Sidebar state preserved via URL param across navigation (completed)
- [x] Navigate to `/v/{sessionId}` after query completes for URL caching (completed)
- [x] Status-based styling in existing renderers (cards, tables) for problem indication
- [x] `BarChartRenderer` component for resource metrics visualization
- [ ] `AIActionBar` component with Query, Remediate, Operate, Recommend buttons (for resource detail views)
- [ ] `AIResultsPanel` side panel for AI responses
- [ ] MCP client functions for remediate/operate/recommend/capabilities
- [ ] Context passing - send resource details to MCP tools

**Validation**: Click "Analyze Cluster Health" on dashboard home, see AI analysis rendered inline

### Milestone 6: Polish & Error Handling
- [x] Loading skeletons for resource lists
- [ ] Error states for K8s connection failures
- [x] Empty states for namespaces with no resources
- [ ] Mobile-responsive sidebar

**Validation**: Dashboard handles edge cases gracefully (no cluster, empty namespace, errors)

### Milestone 7: Search & Agentic Chat (To Be Designed)

#### Search
- [ ] Design: Search UX - global search bar? keyboard shortcut? scope (current namespace vs all)?
- [ ] Design: Search backend - Qdrant semantic search? text matching? filters?
- [ ] Design: Search results presentation - inline dropdown? dedicated page? resource type grouping?
- [ ] Implementation: Search component and API integration

#### Agentic Chat

**Architectural Decisions (Resolved)**
- [x] Decision: No generic free-form chat for v1 - focus on tool-specific integrations instead
- [x] Decision: LLM communication stays in MCP server (API keys never exposed to browser)
- [x] Decision: UI maintains conversation context for tool workflows (stateless MCP for chat)
- Rationale: Generic chat without tool access provides limited value (just ChatGPT in a sidebar); tool-specific integrations deliver immediate cluster-aware value

**Architecture**
```
UI (dot-ai-ui)          Express Proxy           MCP Server (dot-ai)
+-------------+         +-------------+         +------------------+
| Tool UI     |  HTTP   | /api/...    |  HTTP   | Tool endpoints   |
| - Context   |-------->| (proxy)     |-------->| - LLM API keys   |
| - History   |<--------|             |<--------| - Tool execution |
+-------------+         +-------------+         +------------------+
```

**Deferred Design Questions**
- [ ] Design: Chat UX - side panel? modal? persistent drawer? conversation history?
- [ ] Design: Chat context - how to pass current resource/namespace context to agent?
- [ ] Design: Action execution - how should chat-suggested actions be presented and executed?
- [ ] Design: Chat backend - streaming responses? conversation memory? tool calling UI?
- [ ] Implementation: Chat component and MCP integration

**Validation**: Users can search resources and have natural language conversations with AI about their cluster

---

## Out of Scope (Future Considerations)

- Resource creation/editing (read-only for v1)
- Real-time WebSocket updates (polling is sufficient for v1)
- Multi-cluster support
- User authentication/RBAC in dashboard (uses cluster credentials)

---

## Development Setup

### Connecting to MCP Server

The dashboard requires a running MCP server. For development with the test cluster:

```bash
# 1. Set kubeconfig to test cluster
export KUBECONFIG=kubeconfig-test.yaml

# 2. Get auth token from cluster secret
export DOT_AI_AUTH_TOKEN=$(kubectl get secret -n dot-ai dot-ai-secrets -o jsonpath='{.data.auth-token}' | base64 -d)

# 3. Set MCP URL (from Ingress - kind maps port 80 to 8180)
export DOT_AI_MCP_URL="http://dot-ai.127.0.0.1.nip.io:8180"

# 4. Start dev server
npm run dev
```

The MCP server URL can be found via: `kubectl get ingress -n dot-ai`

---

## Dependencies

### UI Dependencies
- `@tanstack/react-query` - Server state management (planned, using useState/useEffect currently)
- Existing MCP proxy infrastructure (all K8s data flows through MCP)

### External Dependencies (dot-ai MCP)
- New `listResourceKinds` MCP tool - for sidebar population
- New `listResources` MCP tool - for resource tables
- New `listNamespaces` MCP tool - for namespace dropdown
- dot-ai-controller syncing resources to Qdrant

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large clusters with many resources slow down queries | High | Pagination in `listResources`, limit displayed results |
| CRDs without status fields break status display | Medium | Graceful fallback for missing status patterns |
| K8s API auth complexity (for status enrichment) | Medium | Auto-detect auth method, clear error messages |
| Qdrant data staleness | Medium | Show "last synced" timestamp, rely on dot-ai-controller |
| MCP endpoints not yet implemented | High | Use mock data until MCP is ready (Milestone 0 complete) |

---

## Decision Log

| Date | Decision | Rationale | Impact |
|------|----------|-----------|--------|
| 2025-01-08 | PRD created | Initial planning | - |
| 2025-01-08 | Hybrid data architecture (Qdrant + K8s API) | Qdrant already stores resource metadata via dot-ai-controller; storing status would cause heavy sync traffic due to frequent changes | Simplified architecture - no need for full K8s client in UI; depends on new MCP endpoints |
| 2025-01-08 | Start with mock UI prototype | Faster validation of UX before backend work; clear target for what MCP endpoints need to return | Added Milestone 0; can iterate on design with hard-coded data |
| 2025-01-08 | New MCP tools required | `listResourceKinds`, `listResources`, `listNamespaces` to expose Qdrant data in structured format | External dependency on dot-ai changes |
| 2025-01-08 | Group sidebar by `apiGroup` instead of hardcoded categories | Dynamic grouping works with any CRDs without code changes; matches K8s API structure | Sidebar shows "core", "apps", "networking.k8s.io", custom CRD groups automatically |
| 2025-01-08 | Only expand "core" group by default | Cleaner initial view for clusters with many resource types | Better UX - users expand other groups as needed |
| 2025-01-10 | MCP handles all K8s API communication | Original plan had UI using `@kubernetes/client-node` directly. MCP already has K8s client and returns live data via `/api/v1/resource`, `/api/v1/events`, `/api/v1/logs` | Simplified architecture - removed `@kubernetes/client-node` dependency from UI; all K8s auth handled by MCP |
| 2025-01-10 | Query tool for dashboard home with explicit button | Auto-trigger would spend tokens without user consent; explicit "Analyze Cluster Health" button respects user choice and avoids unexpected costs | Dashboard home shows button instead of empty body; no auto-AI toggle needed |
| 2025-01-10 | Query analyzes entire cluster, not namespace-scoped | Dashboard home is entry point before user selects namespace; cluster-wide analysis provides immediate value | Namespace-specific queries deferred to resource-context usage of Query tool |
| 2025-01-10 | Unified layout: shared sidebar for visualization and dashboard | Users coming from coding agent links should have same navigation as dashboard users; unified experience | Keep separate routes (`/v/{sessionId}` and `/dashboard/*`) but extract shared `DashboardLayout` component |
| 2025-01-10 | Sidebar collapsed for visualization, expanded for resources | Visualizations need more horizontal space for diagrams/tables; resource browsing needs navigation | Sidebar state determined by route/context, user can manually toggle |
| 2025-01-10 | Query tool needs `inline` parameter for direct visualization data | Currently Query returns JSON + link to `/v/{sessionId}`; dashboard needs visualization data directly without redirect | MCP change required: `inline: true` parameter returns visualization payload instead of session link |
| 2025-01-10 | No generic agentic chat for v1 | Generic chat without tool access is just ChatGPT in sidebar - limited value; tool-specific integrations (Query, Remediate, Operate) provide cluster-aware value | Focus on tool integrations; defer free-form chat to future milestone |
| 2025-01-10 | LLM API keys stay in MCP server | Exposing API keys to browser is security risk; MCP already handles authenticated communication | All AI features proxy through MCP; UI never has direct LLM access |

---

## Progress Log

| Date | Update |
|------|--------|
| 2025-01-08 | PRD created |
| 2025-01-08 | Milestone 0 (Mock UI Prototype) completed - dashboard layout, sidebar, resource tables with mock data |
| 2025-01-08 | Architecture decision: hybrid Qdrant + K8s API approach |
| 2025-01-08 | Milestone 1 partial - Sidebar now fetches live data from MCP `/api/v1/resources/kinds`, groups by apiGroup with counts, collapsed state abbreviations, hover effects |
| 2025-01-08 | Milestone 1 partial - Added `getResources()` API client and `/api/v1/resources` proxy route for resource list endpoint |
| 2025-01-08 | Milestone 1 COMPLETED - ResourceList now fetches real data from MCP, replaced all mock data |
| 2025-01-08 | Added `getNamespaces()` API + proxy route, NamespaceSelector fetches from MCP |
| 2025-01-08 | Sidebar filters resource counts by namespace (MCP `?namespace=` param) |
| 2025-01-08 | Added URL query params for state persistence (`?ns=`, `?kind=`, `?group=`, `?version=`) |
| 2025-01-08 | Added loading skeletons and empty states (Milestone 6 partial) |
| 2025-01-08 | Added global cursor:pointer CSS, redirect `/` to `/dashboard` |
| 2025-01-09 | Added printer columns integration - hardcoded columns for core resources, MCP capabilities for CRDs, default fallback |
| 2025-01-09 | Added Milestone 7: Search & Agentic Chat (design phase) |
| 2025-01-09 | Milestone 4 partial - ResourceList with dynamic printer columns, JSONPath extraction, status formatting |
| 2025-01-09 | Fixed apiVersion duplication bug, added dynamic Namespace column for "All Namespaces" view |
| 2025-01-09 | Improved collapsed sidebar UX - clicking group expands sidebar and opens group |
| 2025-01-09 | Added comprehensive BUILTIN_RESOURCE_COLUMNS for all built-in K8s resources (core, apps, batch, networking, rbac, storage, flowcontrol, etc.) with correct jsonPaths |
| 2025-01-09 | Added filtering for MCP columns with empty jsonPath or .spec references (MCP doesn't return spec data) |
| 2025-01-09 | Fixed apiVersion key format for built-in resources - uses full apiVersion format (e.g., `apps/v1`, `rbac.authorization.k8s.io/v1`) |
| 2025-01-09 | Verified all built-in resources display correct columns: Pod (Status), Deployment (Ready/Available), DaemonSet (Desired/Current), ReplicaSet (Desired/Ready), etc. |
| 2025-01-09 | Added table sorting - default by Name ascending, clickable column headers with sort icons, toggle asc/desc, type-aware comparison (strings, numbers, dates) |
| 2025-01-09 | Added namespace click-to-filter - clicking namespace value in table filters to that namespace, updates URL and dropdown |
| 2025-01-09 | Added pattern-based status coloring - green for healthy states (Running, Succeeded, Active), yellow for warnings (Pending, Terminating), red for errors (Failed, CrashLoopBackOff) via new `src/utils/statusColors.ts` utility |
| 2025-01-09 | Milestone 4 partial - ResourceDetailPage UI structure with tabs, CollapsibleTree component for nested data, ExpandableDescription for resource descriptions, clickable resource names linking to detail view. NOTE: Page uses mock data, not connected to real MCP API yet |
| 2025-01-09 | PRD accuracy update - Split ResourceDetailPage checkbox into granular items to accurately track: API connection, each tab implementation, header description. Previous checkbox was premature. |
| 2025-01-09 | Milestone 4 partial - ResourceDetailPage now fetches capabilities from MCP (description, useCase, printerColumns) with multi-item cache. Resource data (metadata, spec, status) still uses mock data pending MCP single-resource endpoint. Added Development Setup section to PRD. Created cross-project skills (query-dot-ai, request-dot-ai-feature) for dot-ai ecosystem collaboration. |
| 2025-01-09 | Milestone 4 major - ResourceDetailPage now connected to real MCP API via new `/api/v1/resource` endpoint. Added `getResource()` API client. Overview, Metadata, Spec, Status tabs all show real K8s data. Added `includeSpec` option to `getBuiltinResourceColumns()` - detail page shows all columns (IP, Node, Host IP, Service Account, etc.) while list view remains minimal. |
| 2025-01-09 | Milestone 4 - YAML tab implemented. Added `yaml` package, `resourceToYaml()` function with canonical K8s field ordering (apiVersion → kind → metadata → spec → status), `YamlView` component with Prism syntax highlighting and copy-to-clipboard. Verified MCP returns identical data to kubectl (queries K8s API directly, not Qdrant). |
| 2025-01-10 | Milestone 4 - Events tab implemented. Added `/api/v1/events` proxy endpoint (server/index.ts), `getResourceEvents()` API client, `EventsView` component with table display (Type, Reason, Age, Source, Message). Events lazy-loaded when tab selected. Tab state persists in URL via `?tab=` param. Verified with Playwright for Normal and Warning event types. Required new MCP endpoint `/api/v1/events` in dot-ai. |
| 2025-01-10 | Milestone 4 COMPLETED - Logs tab implemented for Pod resources. Added `/api/v1/logs` proxy endpoint, `getPodLogs()` API client, `LogsView` component with container selector, Tail button for live polling (3s interval), auto-scroll to bottom on refresh. Logs tab conditionally shown only for Pod kind via `getTabsForKind()`. Required new MCP endpoint `/api/v1/logs` in dot-ai. Updated CLAUDE.md with MCP integration guidance. |
| 2025-01-10 | Milestone 2 COMPLETED - Rewrote milestone to reflect actual architecture. Original plan assumed `@kubernetes/client-node` in UI; actual implementation uses MCP for all K8s communication. Live data endpoints (`/api/v1/resource`, `/api/v1/events`, `/api/v1/logs`) all proxy to MCP which queries K8s API directly. |
| 2025-01-10 | Milestone 5 design phase - Query tool integration designed for dashboard home. Key decisions: explicit "Analyze Cluster Health" button (no auto-trigger), cluster-wide analysis, inline visualization rendering using existing components. Unified layout architecture: shared sidebar between `/v/{sessionId}` and `/dashboard/*` routes, sidebar collapsed for visualizations. MCP requirement identified: `inline` parameter for Query tool to return visualization data directly. |
| 2025-01-10 | Milestone 7 architecture - Decided against generic agentic chat for v1. LLM communication stays in MCP server (security). Focus on tool-specific integrations (Query, Remediate, Operate) which provide cluster-aware value. Generic chat deferred. |
| 2025-01-10 | Milestone 5 implementation - SharedDashboardLayout, DashboardHome with Analyze Cluster Health button, Query API client, sidebar state preservation via URL param (`sb=0|1`), navigation to `/v/{sessionId}` after query for URL caching. |
| 2025-01-10 | Problem indication via AI-driven styling | Let AI handle problem visualization fully - Mermaid uses native `style` directives for red coloring, Cards/Tables use `status` field. Keeps UI simple, gives AI flexibility. | MCP prompt changes needed; minimal UI changes (respect status field) |
| 2025-01-10 | Bar charts for resource metrics | Add bar chart as first graph type for resource usage (memory, CPU). Start with ONE chart type, prove it works before adding others. Pie charts excluded (poor data viz). | New BarChartRenderer component; MCP needs bar-chart visualization type |
| 2025-01-10 | Sidebar state preservation via URL | Use `sb` URL param (`sb=1` collapsed, `sb=0` expanded) to preserve sidebar state across navigation between dashboard and visualization pages. | Consistent UX when navigating; sidebar preference persists |
| 2025-01-11 | Milestone 5 partial - Status-based problem indication complete for all visualization types. UI: Cards/Tables use `status`/`rowStatuses` fields with colored left borders (red=error, yellow=warning, green=ok). MCP: Mermaid prompts updated to use red styling for error nodes only, no colors for healthy nodes. Added tab status indicators as bonus UX (red/yellow dots on tabs with issues). Dashboard home alignment fixed (top-aligned vs vertically centered). Cross-project skills created (request-dot-ai-feature, process-feature-request) for file-based feature request workflow. |
| 2025-01-11 | Milestone 5 - BarChartRenderer implemented. New visualization type for resource metrics (memory, CPU usage). Types added (BarChartBar, BarChartContent, BarChartVisualization), horizontal/vertical orientations supported, status-based coloring (red=error, yellow=warning, green=ok, blue=default). Integrated into VisualizationRenderer switch. Added bar-chart support to TabContainer for tab status indicators. Coordinated with MCP via cross-project feature request workflow. Verified rendering with Playwright - bars display correctly with status colors. |

