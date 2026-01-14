# PRD: Organizational Data Management (Patterns & Policies)

**Issue**: [#8](https://github.com/vfarcic/dot-ai-ui/issues/8)
**Status**: Draft
**Priority**: High
**Created**: 2025-01-14

---

## Problem Statement

Users of the Kubernetes Dashboard cannot view or manage the organizational patterns and policies that influence AI recommendations. When using Recommend or Operate tools, the AI applies organizational context (patterns, policies) but users have no visibility into:

1. What patterns exist and how they guide recommendations
2. What policies constrain AI-generated configurations
3. Why certain resources or configurations are suggested over others
4. How to add new patterns or policies to customize AI behavior for their organization

This creates a "black box" experience where AI recommendations feel arbitrary rather than transparent and controllable.

---

## Solution Overview

Add a dedicated section in the Kubernetes Dashboard for managing organizational data:

1. **Patterns View**: List, view details, create, and delete organizational patterns
2. **Policies View**: List, view details, create, and delete policy intents
3. **Integration Visibility**: Show which patterns/policies were applied in Recommend and Operate results (already partially implemented via `appliedPatterns` and `policiesChecked` fields)

### Key Differentiators from Other Tools

- **CRUD Operations**: Unlike Query/Remediate/Operate/Recommend (which are action-oriented), Organizational Data is resource management
- **No Workflow**: Simple list/detail/create/delete - no multi-step wizard or approval flow
- **Navigation-Based**: Accessed via sidebar, not ActionBar
- **Static Data**: Patterns and policies don't change frequently; no polling needed

---

## User Journey

### Primary Flow: Viewing Existing Patterns

1. User navigates to `/dashboard`
2. Clicks "Organizational Data" section in sidebar (new top-level section)
3. Sees two sub-items: "Patterns" and "Policies"
4. Clicks "Patterns" → sees list of all patterns with description, trigger count, resource count
5. Clicks a pattern → sees detail view with full information (triggers, suggested resources, rationale)
6. Can delete pattern from detail view

### Secondary Flow: Creating a New Pattern

1. User is on Patterns list view
2. Clicks "Create Pattern" button
3. Fills out form: description, triggers (tags input), suggested resources, rationale
4. Clicks "Create" → pattern saved, redirects to list view
5. New pattern now influences Recommend and Operate tool outputs

### Tertiary Flow: Understanding AI Recommendations

1. User runs Recommend tool for "deploy a web application"
2. Results show "Applied Patterns: Horizontal scaling with HPA"
3. User clicks pattern name → navigates to pattern detail view
4. User understands why HPA was recommended for their deployment

---

## Technical Approach

### Architecture

```
Frontend (React)                    Express Proxy              MCP Server
+-------------------+              +------------------+        +------------------+
| Patterns List     |   HTTP       | /api/v1/org/*    |  HTTP  | manageOrgData    |
| Patterns Detail   |------------->| (new proxy)      |------->| tool             |
| Policies List     |              +------------------+        +------------------+
| Policies Detail   |
| Create Forms      |
+-------------------+
```

### MCP Integration

Uses existing `manageOrgData` tool with operations:
- `list` - Get all patterns or policies
- `get` - Get single pattern or policy by ID
- `create` - Create new pattern or policy
- `delete` - Delete pattern or policy by ID
- `search` - Search patterns or policies (future enhancement)

### Data Shapes (from MCP)

**Pattern:**
```typescript
interface Pattern {
  id: string;
  description: string;
  triggers: string[];           // Keywords that activate this pattern
  suggestedResources: string[]; // K8s resources to include
  rationale: string;            // Why this pattern exists
  createdAt: string;
  createdBy: string;
}
```

**Policy:**
```typescript
interface PolicyIntent {
  id: string;
  description: string;
  // Structure TBD - need to test MCP policy responses
  createdAt: string;
  createdBy: string;
}
```

### Key Technical Decisions

1. **Sidebar Placement**: New top-level "Organization" section below resource groups
2. **No ActionBar Integration**: This is navigation/CRUD, not AI tool invocation
3. **Simple Forms**: Standard form inputs, no wizard workflow needed
4. **Linkable Details**: Pattern/policy names in Recommend/Operate results link to detail views

---

## Success Criteria

1. **Visibility**: Users can view all patterns and policies in their cluster
2. **Manageability**: Users can create and delete patterns/policies from the UI
3. **Transparency**: Users understand how patterns/policies affect AI recommendations
4. **Integration**: Clicking pattern/policy names in tool results navigates to detail views

---

## Milestones

### Milestone 1: Patterns List & Detail Views
- [ ] Add "Organization" section to sidebar with Patterns/Policies sub-items
- [ ] Create `/dashboard/org/patterns` route with patterns list
- [ ] Create `/dashboard/org/patterns/:id` route with pattern detail view
- [ ] API client functions for patterns (`listPatterns`, `getPattern`)
- [ ] Proxy endpoints for pattern operations

**Validation**: Navigate to Patterns in sidebar, see list, click to view details

### Milestone 2: Pattern Creation & Deletion
- [ ] Add "Create Pattern" button to patterns list
- [ ] Create pattern form with validation (description required, at least one trigger)
- [ ] Delete button on pattern detail view with confirmation
- [ ] API client functions (`createPattern`, `deletePattern`)

**Validation**: Create a new pattern, verify it appears in list, delete it

### Milestone 3: Policies List & Detail Views
- [ ] Create `/dashboard/org/policies` route with policies list
- [ ] Create `/dashboard/org/policies/:id` route with policy detail view
- [ ] API client functions for policies (`listPolicies`, `getPolicy`)
- [ ] Proxy endpoints for policy operations

**Validation**: Navigate to Policies in sidebar, see list, click to view details

### Milestone 4: Policy Creation & Deletion
- [ ] Add "Create Policy" button to policies list
- [ ] Create policy form (structure TBD based on MCP policy format)
- [ ] Delete button on policy detail view with confirmation
- [ ] API client functions (`createPolicy`, `deletePolicy`)

**Validation**: Create a new policy, verify it appears in list, delete it

### Milestone 5: Cross-Linking from AI Tools
- [ ] Make pattern names clickable in Recommend results (links to `/dashboard/org/patterns/:id`)
- [ ] Make policy names clickable in Operate results
- [ ] Add "View Applied Patterns" section to Recommend solution info

**Validation**: Run Recommend, click an applied pattern name, navigate to pattern detail

---

## Out of Scope (Future Considerations)

- Pattern/policy editing (delete and recreate for v1)
- Pattern/policy search (list with client-side filter for v1)
- Pattern versioning or history
- Role-based access control for pattern/policy management
- Bulk import/export of patterns/policies

---

## Dependencies

### UI Dependencies
- Existing sidebar infrastructure (SharedDashboardLayout)
- Existing detail page patterns (ResourceDetailPage can inform structure)

### External Dependencies (dot-ai MCP)
- `manageOrgData` tool with pattern and policy operations (already implemented)
- Stable response formats for patterns and policies

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Policy data shape unclear | Medium | Test MCP policy endpoints before implementation |
| Patterns list grows large | Low | Add client-side filtering; pagination in future |
| Users create conflicting patterns | Medium | Show warning if triggers overlap with existing patterns |

---

## Decision Log

| Date | Decision | Rationale | Impact |
|------|----------|-----------|--------|
| 2025-01-14 | PRD created | Completes Milestone 5 AI tool integration in PRD 7 | - |
| 2025-01-14 | Sidebar placement (not ActionBar) | Patterns/policies are resources to browse, not actions to invoke | Different UX pattern from other tools |
| 2025-01-14 | No editing for v1 | Simplifies implementation; delete+recreate is acceptable for infrequent changes | Reduced scope |

---

## Progress Log

| Date | Update |
|------|--------|
| 2025-01-14 | PRD created |

