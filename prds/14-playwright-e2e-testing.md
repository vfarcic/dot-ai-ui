# PRD: Playwright E2E Testing Infrastructure

**GitHub Issue**: #14
**Priority**: High
**Status**: Draft

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

- [ ] **Discuss: Which UI components/flows should be tested first?**
  - Visualization renderers (Mermaid, Cards, Code, Table)?
  - Session management and navigation?
  - Error states and loading states?
  - Priority order for test coverage

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| dot-ai mock server | In Progress | Feature request submitted, response expected |

## Milestones

- [ ] **M1: Playwright infrastructure setup**
  - Install `@playwright/test` and dependencies
  - Create `playwright.config.ts` with appropriate settings
  - Add npm scripts for running tests locally
  - Verify basic test can navigate to dev server

- [ ] **M2: Mock server integration**
  - Integrate dot-ai mock server startup into test setup
  - Configure test environment to use mock endpoints
  - Verify tests receive deterministic mock data

- [ ] **M3: Determine test coverage priorities**
  - Discuss and decide which components to test first
  - Document test coverage plan
  - Create test file structure

- [ ] **M4: Implement core component tests**
  - Tests for priority components identified in M3
  - Cover success states, error states, loading states
  - Ensure tests are reliable and not flaky

- [ ] **M5: CI integration**
  - Add GitHub Actions workflow for Playwright tests
  - Configure to run on every PR
  - Add screenshot artifacts on failure
  - Ensure tests block merge on failure

- [ ] **M6: Documentation and workflow integration**
  - Document how to write new tests
  - Update CLAUDE.md with test workflow
  - Create test templates for common patterns

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
