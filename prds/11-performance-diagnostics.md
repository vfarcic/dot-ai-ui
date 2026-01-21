# PRD #11: Performance Diagnostics and Optimization

**GitHub Issue**: [#11](https://github.com/vfarcic/dot-ai-ui/issues/11)
**Status**: Draft
**Priority**: High
**Created**: 2026-01-21

## Problem Statement

Resource navigation in the dashboard has inconsistent performance. When selecting resources from the left-hand sidebar menu, load times vary significantly - sometimes near-instant, sometimes taking several seconds. This unpredictable behavior degrades user experience.

The root cause is currently unknown and could be:
1. **Client-side (UI)** - React rendering, state management, unnecessary re-renders
2. **Network** - Latency between UI backend (Express proxy) and MCP server
3. **Server-side (MCP)** - MCP server processing time, Kubernetes API calls, Qdrant queries

## Solution Overview

Implement a two-phase approach:

**Phase 1: Diagnostics**
- Add performance timing instrumentation throughout the request lifecycle
- Identify where time is spent (UI rendering, network, server processing)
- Developer-only visibility via console logs and optional debug mode

**Phase 2: Optimization**
- Fix bottlenecks identified in Phase 1
- If MCP server is the bottleneck, create a separate PRD in the dot-ai project
- Target: metadata fetch should complete in < 200ms

## Success Criteria

- [ ] Metadata fetch (without status) completes in < 200ms for 90% of requests
- [ ] Clear visibility into where time is spent for each request
- [ ] Identified bottlenecks are fixed or delegated to appropriate project
- [ ] No regression in functionality

## User Impact

**Target Users**: Developers and operators using the Kubernetes dashboard

**User Journey**:
1. User clicks a resource type in the sidebar
2. Resource list loads consistently fast (< 200ms for metadata)
3. If debugging, developer can see timing breakdown in console

## Technical Scope

### Areas to Instrument

1. **API Client Layer** (`src/api/dashboard.ts`)
   - `getResources()` - metadata fetch timing
   - `getCapabilities()` - capabilities fetch timing (note: already cached)
   - Network request/response timing

2. **Component Layer** (`src/components/dashboard/ResourceList.tsx`)
   - Time from navigation to render complete
   - State update timing

3. **Express Proxy** (`server/index.ts`)
   - Request received to MCP response timing
   - MCP server response time (via headers or logging)

### Potential Optimizations to Investigate

1. **Caching**
   - Are capabilities being cached effectively?
   - Should resource metadata be cached short-term?

2. **Request optimization**
   - Are we making unnecessary requests?
   - Can requests be batched or parallelized better?

3. **React rendering**
   - Are there unnecessary re-renders?
   - Should we add memoization?

4. **MCP Server** (if identified as bottleneck)
   - Delegate to dot-ai project with separate PRD
   - Include timing data to help diagnose

## Integration Points

- **MCP Server**: If bottleneck is server-side, requires coordination with dot-ai project
- **Express Proxy**: May need to add timing headers for server-side visibility
- **Browser DevTools**: Diagnostics should complement (not duplicate) DevTools Network tab

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Bottleneck is in MCP server | Medium | Create PRD in dot-ai project with diagnostic data |
| Performance logging adds overhead | Low | Make logging conditional (debug mode only) |
| Root cause is external (K8s API, network) | Medium | Document findings, consider client-side caching |

## Milestones

### Milestone 1: Add Performance Instrumentation
- [ ] Add timing wrapper to API client functions
- [ ] Add console logging with timing breakdown (debug mode)
- [ ] Add server-side timing in Express proxy
- [ ] Document how to enable/read performance logs

### Milestone 2: Collect and Analyze Performance Data
- [ ] Test with various resource types and cluster sizes
- [ ] Identify consistent patterns (which requests are slow, when)
- [ ] Determine primary bottleneck location (UI/network/MCP)

### Milestone 3: Implement UI-Side Optimizations (if applicable)
- [ ] Fix any identified React rendering issues
- [ ] Add caching where beneficial
- [ ] Optimize request patterns if needed

### Milestone 4: Delegate MCP Optimizations (if applicable)
- [ ] Create PRD in dot-ai project with diagnostic data
- [ ] Include specific timing measurements and patterns
- [ ] Coordinate on expected improvements

### Milestone 5: Validate Performance Targets
- [ ] Verify metadata fetch < 200ms for 90% of requests
- [ ] Confirm consistent performance across resource types
- [ ] Remove or disable verbose logging (keep debug mode option)

## Dependencies

- Access to production deployment for realistic performance testing
- MCP server logs/metrics (if server-side investigation needed)

## Out of Scope

- Background status fetch optimization (separate concern)
- UI/UX changes beyond developer debug tools
- Comprehensive APM/monitoring solution

## Open Questions

1. What is the current baseline performance? (need measurements)
2. Is the inconsistency related to specific resource types or random?
3. Does the MCP server have existing performance logging we can leverage?

## Notes

- The capabilities cache already exists and should make repeated navigation to the same resource type fast
- The "fast fetch" (metadata only) is the focus - background status fetch is expected to be slower
- Chrome DevTools Network tab can provide TTFB to help isolate server vs network time
