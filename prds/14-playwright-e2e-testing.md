# PRD: Playwright E2E Testing Infrastructure

**GitHub Issue**: #14
**Priority**: High
**Status**: Complete

## Problem Statement

The dot-ai-ui project lacks automated end-to-end tests. Currently, feature verification relies on manual checking using Playwright MCP during development. This approach has several issues:

1. **No regression protection** - Changes can break existing functionality without detection
2. **Manual verification doesn't scale** - As the UI grows, manual checking becomes time-consuming
3. **CI has no visual validation** - Build checks pass even when rendering is broken
4. **Knowledge loss** - Manual verification steps aren't captured for future reference

## Solution Overview

Add Playwright test infrastructure that:
1. Uses dot-ai's mock server for deterministic test data
2. Runs automatically on every PR
3. Covers critical UI components and user flows
4. Converts the manual Playwright MCP verification workflow into automated tests

## User Journey

### Current State (Manual)
1. Developer implements feature
2. Claude uses Playwright MCP to manually verify (browser_navigate, browser_snapshot)
3. Developer reviews visual output
4. No automated record of what was verified
5. Future changes may break the feature undetected

### Future State (Automated)
1. Developer implements feature
2. Claude uses Playwright MCP to manually verify (same as before)
3. Claude converts verification steps into Playwright test
4. Test runs in CI on every PR
5. Future regressions are caught automatically

## Technical Approach

### Mock Server Integration
- dot-ai will provide a mock HTTP server for the REST API endpoints
- Mock server provides deterministic responses for `/api/v1/resources`, `/api/v1/events`, `/api/v1/logs`
- Same mock used for both manual development and automated tests

### Test Infrastructure
- Playwright Test (`@playwright/test`) as the testing framework
- Tests located in `tests/` or `e2e/` directory
- Configuration in `playwright.config.ts`

### CI Integration
- Tests run on every PR via GitHub Actions
- Failure blocks PR merge
- Screenshots captured on failure for debugging

## Open Questions

- [x] **Discuss: Which UI components/flows should be tested first?**
  - **Decision**: Dashboard first (sidebar resource list, namespace dropdown, resource table)
  - Visualization page second (Mermaid diagrams)
  - Error/loading states deferred to future PRDs

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| dot-ai mock server | ✅ Available | `ghcr.io/vfarcic/dot-ai-mock-server:latest` - endpoints for resources/kinds, namespaces, resources, visualize |

## Milestones

- [x] **M1: Playwright infrastructure setup**
  - [x] Install `@playwright/test` and dependencies
  - [x] Create `playwright.config.ts` with appropriate settings
  - [x] Add npm scripts for running tests locally
  - [x] Verify basic test can navigate to dev server

- [x] **M2: Mock server integration**
  - [x] Integrate dot-ai mock server startup into test setup (`e2e/docker-compose.yml`)
  - [x] Configure test environment to use mock endpoints (`DOT_AI_MCP_URL=http://localhost:3001`)
  - [x] Verify tests receive deterministic mock data (dashboard tests use mock data)

- [x] **M3: Determine test coverage priorities**
  - [x] Discuss and decide which components to test first (Dashboard → Visualization → Error states)
  - [x] Document test coverage plan (see Open Questions resolution)
  - [x] Create test file structure (`e2e/dashboard.spec.ts`)

- [ ] **M4: Implement core component tests**
  - [x] MVP dashboard tests (sidebar, namespace dropdown, resource list) - 3 passing tests
  - [ ] Cover error states, loading states (deferred to future PRDs)
  - [x] Ensure tests are reliable and not flaky (using mock server)

- [x] **M5: CI integration**
  - [x] Add GitHub Actions workflow for Playwright tests
  - [x] Configure to run on every PR
  - [x] Add screenshot artifacts on failure
  - [x] Ensure tests block merge on failure

- [x] **M6: Documentation and workflow integration**
  - [x] Document how to write new tests (`/generate-e2e-tests` skill created)
  - [x] Update CLAUDE.md with test workflow
  - [x] Create test templates for common patterns (skill includes patterns and guidelines)

## Success Criteria

1. Playwright tests run successfully in CI on every PR
2. Tests use mock server for deterministic results
3. At least core visualization components have test coverage
4. Failed tests block PR merge
5. New features can easily add corresponding tests

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Mock server delays | Blocks M2 | Can proceed with M1, M3 in parallel |
| Flaky tests | Erodes trust in CI | Use mock server, avoid timing dependencies |
| Test maintenance burden | Slows development | Focus on critical paths, avoid over-testing |

## Timeline Estimate

This PRD does not include time estimates. Milestones are ordered by dependency, and M1/M3 can proceed in parallel while waiting for mock server availability.
