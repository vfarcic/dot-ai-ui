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
| Live status (pod phase, replicas) | Kubernetes API | Direct via `@kubernetes/client-node` |
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

### Milestone 1: MCP Integration (Resource Discovery)
- [x] MCP client functions for `listResourceKinds` endpoint
- [ ] MCP client functions for `listResources` endpoint
- [ ] Replace mock data with MCP queries (resource list)
- [x] Dynamic sidebar populated from `listResourceKinds`
- [ ] Resource tables populated from `listResources`

**Validation**: Dashboard shows real resources from Qdrant via MCP

**Dependency**: Requires dot-ai MCP to implement the new endpoints first

### Milestone 2: K8s Status Enrichment
- [ ] K8s client initialization with auto-detection (kubeconfig/in-cluster)
- [ ] Status endpoint for enriching displayed resources (`/api/k8s/status/:kind/:namespace/:name`)
- [ ] Merge MCP metadata with K8s live status in frontend
- [ ] Pod logs endpoint (special case)

**Validation**: Resource tables show live status (Running, CrashLoopBackOff, replica counts)

### Milestone 3: Frontend Infrastructure
- [ ] React Query setup for data fetching
- [ ] Namespace context provider
- [ ] Generic resource hooks with polling
- [ ] Caching strategy for MCP data vs K8s status data

**Validation**: Hooks successfully fetch, cache, and merge data from both sources

### Milestone 4: Resource List & Detail Views
- [ ] Generic `ResourceListPage` with dynamic columns
- [ ] Generic `ResourceDetailPage` with tabs (Overview, YAML, Events)
- [ ] Pod-specific Logs tab
- [ ] Status badges and age formatting

**Validation**: Can list and view details of any resource type (Pods, Deployments, CRDs)

### Milestone 5: AI Action Integration

#### Design Phase
- [ ] Design: Query tool integration - what questions make sense from resource context?
- [ ] Design: Remediate tool integration - how to present analysis and suggested fixes?
- [ ] Design: Operate tool integration - what Day 2 operations to expose (scale, update, rollback)?
- [ ] Design: Recommend tool integration - when/where to show deployment recommendations?

#### Implementation
- [ ] `AIActionBar` component with Query, Remediate, Operate, Recommend buttons
- [ ] `AIResultsPanel` side panel for AI responses
- [ ] MCP client functions for query/remediate/operate/recommend
- [ ] Context passing - send resource details to MCP tools
- [ ] Link to full visualization (`/v/{sessionId}`) for complex outputs

**Validation**: Click "Remediate" on a resource, see AI analysis in side panel

### Milestone 6: Polish & Error Handling
- [ ] Loading skeletons for resource lists
- [ ] Error states for K8s connection failures
- [ ] Empty states for namespaces with no resources
- [ ] Mobile-responsive sidebar

**Validation**: Dashboard handles edge cases gracefully (no cluster, empty namespace, errors)

---

## Out of Scope (Future Considerations)

- Resource creation/editing (read-only for v1)
- Real-time WebSocket updates (polling is sufficient for v1)
- Multi-cluster support
- User authentication/RBAC in dashboard (uses cluster credentials)

---

## Dependencies

### UI Dependencies
- `@tanstack/react-query` - Server state management
- `@kubernetes/client-node` - Kubernetes API client (for status enrichment only)
- Existing MCP proxy infrastructure

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

---

## Progress Log

| Date | Update |
|------|--------|
| 2025-01-08 | PRD created |
| 2025-01-08 | Milestone 0 (Mock UI Prototype) completed - dashboard layout, sidebar, resource tables with mock data |
| 2025-01-08 | Architecture decision: hybrid Qdrant + K8s API approach |
| 2025-01-08 | Milestone 1 partial - Sidebar now fetches live data from MCP `/api/v1/resources/kinds`, groups by apiGroup with counts, collapsed state abbreviations, hover effects |

