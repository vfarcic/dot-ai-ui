# PRD: React Query Integration

**Issue**: [#9](https://github.com/vfarcic/dot-ai-ui/issues/9)
**Status**: Draft
**Priority**: Low
**Created**: 2025-01-14

---

## Problem Statement

The current data fetching implementation uses manual `useState`/`useEffect` patterns across multiple components:

1. **Boilerplate overhead**: Each component has ~20-30 lines for loading state, error state, data state, and useEffect fetch logic
2. **No caching**: Navigating from Pod list → Pod detail → back to Pod list re-fetches data instead of serving from cache
3. **Manual polling**: Components like LogsView implement custom `setInterval` polling logic
4. **Request duplication**: Multiple components needing the same data (e.g., namespaces) make separate API calls
5. **Inconsistent patterns**: Each component implements its own error handling and loading state management

---

## Solution Overview

Migrate to React Query (`@tanstack/react-query`) to provide:

1. **Automatic caching**: Data persists across navigations, serving instantly from cache
2. **Request deduplication**: Multiple components requesting the same data share a single request
3. **Background refetching**: Stale data is refreshed automatically without blocking UI
4. **Built-in polling**: Replace manual `setInterval` with React Query's `refetchInterval`
5. **Consistent patterns**: Standardized loading/error/data handling across all components

---

## Affected Components

| Component | Current Pattern | React Query Benefit |
|-----------|-----------------|---------------------|
| `DashboardSidebar` | `useState` + `useEffect` for resource kinds | Cache across namespace changes |
| `ResourceList` | `useState` + `useEffect` + `useCallback` | Cache list data, dedupe requests |
| `ResourceDetail` | Multiple `useEffect` for resource, capabilities, events, logs | Parallel queries, cache detail views |
| `NamespaceSelector` | `useState` + `useEffect` | Share namespace data globally |
| `Visualization` | `useState` + `useEffect` for session data | Cache visualization results |

---

## Technical Approach

### Query Key Strategy

```typescript
// Hierarchical key structure for proper cache invalidation
const queryKeys = {
  resourceKinds: (namespace?: string) => ['resourceKinds', namespace] as const,
  resources: (kind: string, namespace?: string) => ['resources', kind, namespace] as const,
  resource: (kind: string, name: string, namespace?: string) => ['resource', kind, name, namespace] as const,
  namespaces: () => ['namespaces'] as const,
  events: (kind: string, name: string, namespace?: string) => ['events', kind, name, namespace] as const,
  logs: (podName: string, namespace: string, container?: string) => ['logs', podName, namespace, container] as const,
  visualization: (sessionId: string) => ['visualization', sessionId] as const,
}
```

### Caching Strategy

| Data Type | Stale Time | Cache Time | Rationale |
|-----------|------------|------------|-----------|
| Resource kinds | 5 min | 30 min | Changes rarely (new CRDs) |
| Namespaces | 5 min | 30 min | Changes rarely |
| Resource lists | 30 sec | 5 min | Status changes frequently |
| Single resource | 30 sec | 5 min | Status changes frequently |
| Events | 10 sec | 2 min | New events appear often |
| Logs | 0 (always stale) | 1 min | Real-time data, use polling |
| Visualizations | Infinity | 30 min | Immutable once generated |

### Custom Hooks

```typescript
// Example hook replacing current ResourceList useEffect
export function useResources(kind: string, namespace?: string) {
  return useQuery({
    queryKey: queryKeys.resources(kind, namespace),
    queryFn: () => getResources(kind, namespace),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  })
}

// Example hook for logs with polling
export function usePodLogs(podName: string, namespace: string, container?: string) {
  return useQuery({
    queryKey: queryKeys.logs(podName, namespace, container),
    queryFn: () => getPodLogs(podName, namespace, container),
    refetchInterval: 3000, // Replace manual setInterval
    staleTime: 0,
  })
}
```

---

## Success Criteria

1. **Code reduction**: Each migrated component reduces data fetching boilerplate by 50%+
2. **Cache hits**: Navigating back to previously viewed pages serves data instantly
3. **No regressions**: All existing functionality works identically
4. **Consistent patterns**: All data fetching uses React Query hooks

---

## Milestones

### Milestone 1: Setup & Core Hooks
- [ ] Install `@tanstack/react-query` and configure QueryClient
- [ ] Create `src/hooks/queries.ts` with query key factory
- [ ] Create core hooks: `useResourceKinds`, `useResources`, `useNamespaces`
- [ ] Add QueryClientProvider to App.tsx

**Validation**: Hooks exist and can be imported; QueryClient configured with defaults

### Milestone 2: Migrate Dashboard Components
- [ ] Migrate `DashboardSidebar` to use `useResourceKinds`
- [ ] Migrate `ResourceList` to use `useResources`
- [ ] Migrate `NamespaceSelector` to use `useNamespaces`
- [ ] Remove old useState/useEffect patterns from migrated components

**Validation**: Dashboard pages function identically; React Query DevTools show cache hits on navigation

### Milestone 3: Migrate Detail & Visualization Pages
- [ ] Create `useResource`, `useResourceEvents`, `usePodLogs` hooks
- [ ] Migrate `ResourceDetail` page to use new hooks
- [ ] Migrate `Visualization` page to use `useVisualization` hook
- [ ] Replace manual log polling with React Query's `refetchInterval`

**Validation**: Detail pages load correctly; logs poll without custom setInterval

### Milestone 4: Namespace Context Integration
- [ ] Create namespace context that syncs with React Query cache
- [ ] Implement cache invalidation on namespace change
- [ ] Ensure sidebar counts update when namespace changes

**Validation**: Changing namespace invalidates relevant caches and refetches

### Milestone 5: Polish & Cleanup
- [ ] Remove unused state management code
- [ ] Add React Query DevTools for development (disabled in production)
- [ ] Document caching strategy in code comments
- [ ] Verify no duplicate fetches via network tab

**Validation**: Clean codebase; DevTools available in dev mode; no unnecessary network requests

---

## Out of Scope

- Server-side rendering (SSR) considerations
- Optimistic updates for mutations (no write operations in dashboard)
- Offline support / persistence
- React Query infinite queries (pagination handled differently)

---

## Dependencies

- `@tanstack/react-query` ^5.x (already listed in PRD #7 as planned dependency)
- No external dependencies on MCP changes

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing functionality | High | Migrate one component at a time; verify with Playwright |
| Over-caching stale data | Medium | Conservative stale times; explicit invalidation on mutations |
| Learning curve for team | Low | React Query has excellent docs; patterns are straightforward |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-01-14 | PRD created | Consolidate data fetching patterns |
| 2025-01-14 | Priority: Low | Dashboard works correctly; this is incremental improvement |
| 2025-01-14 | Hierarchical query keys | Enables granular cache invalidation |

---

## Progress Log

| Date | Update |
|------|--------|
| 2025-01-14 | PRD created |
