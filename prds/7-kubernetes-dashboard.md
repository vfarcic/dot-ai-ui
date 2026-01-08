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

1. **Lists and describes ANY Kubernetes resource** (including Custom Resources) via direct Kubernetes API access
2. **Integrates AI-powered actions** via MCP tools:
   - **Query**: Natural language questions about resources
   - **Remediate**: AI-powered issue analysis and fix suggestions
   - **Operate**: Day 2 operations (scale, update, rollback)
   - **Recommend**: Deployment recommendations

### Key Differentiators

- **Generic Resource Support**: Automatically discovers and displays ALL resource types via K8s API discovery, including CRDs - no code changes needed for new resource types
- **AI-First Actions**: Every resource detail view includes AI action buttons
- **Unified Experience**: Traditional dashboard + AI capabilities in one interface

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
| Dashboard Pages   |   HTTP       | /api/k8s/*        |---> Kubernetes API
| - Generic Lists   |------------->| /api/v1/mcp/*     |---> MCP Server
| - AI Action Btns  |              +-------------------+
+-------------------+

Key: Uses K8s API Discovery to dynamically find ALL resource types
```

### Data Sources

| Feature | Source | Method |
|---------|--------|--------|
| Resource lists/details | Kubernetes API | Direct via `@kubernetes/client-node` |
| AI Query/Remediate/Operate | MCP Server | Existing proxy pattern |

### Key Technical Decisions

1. **Generic Resource Handling**: Use `CustomObjectsApi` for dynamic access to any resource type
2. **API Discovery**: Cache discovered resources, refresh every 5 minutes
3. **State Management**: React Query for server state (caching, polling)
4. **Routing**: Generic routes like `/dashboard/:group/:version/:kind`

---

## Success Criteria

1. **Resource Discovery**: Dashboard displays ALL resource types available in the cluster, including CRDs
2. **AI Integration**: Users can trigger Remediate/Query/Operate actions from any resource detail view
3. **Performance**: Resource lists load within 2 seconds, AI actions complete within MCP timeout
4. **Usability**: Users can navigate from problem identification to AI-assisted resolution without leaving the dashboard

---

## Milestones

### Milestone 1: Backend K8s Integration
- [ ] K8s client initialization with auto-detection (kubeconfig/in-cluster)
- [ ] API discovery endpoint returning all resource types
- [ ] Generic resource list/get endpoints working for any resource
- [ ] Pod logs endpoint (special case)

**Validation**: `curl /api/k8s/api-resources` returns all cluster resources including CRDs

### Milestone 2: Frontend Infrastructure
- [ ] React Query setup for data fetching
- [ ] K8s API client functions
- [ ] Namespace context provider
- [ ] Generic resource hooks with polling

**Validation**: Hooks successfully fetch and cache resource data

### Milestone 3: Dashboard Layout & Navigation
- [ ] Dashboard layout with collapsible sidebar
- [ ] Dynamic sidebar populated from API discovery
- [ ] Namespace selector component
- [ ] Resource type grouping (Workloads, Network, Config, Custom Resources)

**Validation**: Navigate to `/dashboard`, see sidebar with all discovered resource types

### Milestone 4: Resource List & Detail Views
- [ ] Generic `ResourceListPage` with dynamic columns
- [ ] Generic `ResourceDetailPage` with tabs (Overview, YAML, Events)
- [ ] Pod-specific Logs tab
- [ ] Status badges and age formatting

**Validation**: Can list and view details of any resource type (Pods, Deployments, CRDs)

### Milestone 5: AI Action Integration
- [ ] `AIActionBar` component with Query, Remediate, Operate buttons
- [ ] `AIResultsPanel` side panel for AI responses
- [ ] MCP client functions for query/remediate/operate
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

- `@kubernetes/client-node` - Kubernetes API client
- `@tanstack/react-query` - Server state management
- Existing MCP proxy infrastructure

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large clusters with many resources slow down API discovery | High | Cache discovery results, paginate lists |
| CRDs without status fields break status display | Medium | Graceful fallback for missing status patterns |
| K8s API auth complexity | Medium | Auto-detect auth method, clear error messages |

---

## Progress Log

| Date | Update |
|------|--------|
| 2025-01-08 | PRD created |

