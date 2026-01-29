---
name: generate-e2e-tests
description: Use Playwright MCP to explore a feature, analyze existing tests, and generate/update E2E tests. Prioritizes user journey scenarios over individual element tests.
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
  - mcp__playwright__browser_navigate
  - mcp__playwright__browser_snapshot
  - mcp__playwright__browser_click
  - mcp__playwright__browser_type
  - mcp__playwright__browser_select_option
  - mcp__playwright__browser_close
---

# Generate E2E Tests

Convert manual Playwright MCP verification into automated Playwright tests. This skill explores the UI, analyzes existing test coverage, and proposes scenario-based tests.

## Philosophy

**Prioritize scenarios over individual element tests:**
- Good: "user can navigate from sidebar to resource list and view details"
- Bad: "sidebar button is visible", "table header exists", "row count is correct"

Tests should represent **user journeys** - sequences of actions a user would take to accomplish a goal. Multiple assertions within a single test scenario are preferred over separate tests for each assertion.

## Process

### Phase 1: Context Gathering

1. **Understand the feature** from conversation context or ask the user:
   - What feature was just implemented?
   - What page/route is it on?
   - What are the key user interactions?

2. **Start mock server and dev server** if not running:
   ```bash
   docker compose -f e2e/docker-compose.yml up -d
   # Dev server should be started with mock config:
   # DOT_AI_MCP_URL=http://localhost:3001 DOT_AI_AUTH_TOKEN=mock-token ./scripts/dev-start.sh
   ```

### Phase 2: Exploration with Playwright MCP

3. **Navigate to the feature** using `mcp__playwright__browser_navigate`

4. **Capture snapshots** using `mcp__playwright__browser_snapshot` to understand:
   - Page structure and available elements
   - Interactive elements (buttons, links, inputs)
   - Data displayed from mock server

5. **Interact with the feature** using:
   - `mcp__playwright__browser_click` for buttons/links
   - `mcp__playwright__browser_type` for inputs
   - `mcp__playwright__browser_select_option` for dropdowns

6. **Document the user journey** as you explore:
   - Starting state
   - Actions taken
   - Expected outcomes after each action
   - Final state

### Phase 3: Analyze Existing Tests

7. **Read existing test files** in `e2e/` directory:
   ```
   e2e/*.spec.ts
   ```

8. **Identify coverage gaps**:
   - What scenarios are already tested?
   - What new scenarios does this feature introduce?
   - Can existing tests be extended rather than creating new ones?

### Phase 4: Propose Test Plan

9. **Present the plan** to the user in this format:

```markdown
## E2E Test Plan for [Feature Name]

### Existing Coverage
- [List what's already tested that relates to this feature]

### Proposed Changes

#### Option A: Extend Existing Test (Preferred if applicable)
**File:** `e2e/[existing].spec.ts`
**Test:** `[existing test name]`
**Add assertions for:**
- [New assertion 1]
- [New assertion 2]

#### Option B: New Test Scenario
**File:** `e2e/[new-or-existing].spec.ts`
**Scenario:** `[descriptive scenario name]`
**User Journey:**
1. [Action 1] → [Expected outcome]
2. [Action 2] → [Expected outcome]
3. [Action 3] → [Expected outcome]

### Recommendation
[Which option and why]
```

10. **Wait for user approval** before proceeding

### Phase 5: Implement Tests

11. **Write or update tests** following these patterns:

```typescript
// GOOD: Scenario-based test with multiple assertions
test('user can browse resources and view details', async ({ page }) => {
  // Navigate to starting point
  await page.goto('/dashboard')

  // Action 1: Select a resource type
  await page.getByRole('button', { name: 'Pod' }).click()
  await expect(page).toHaveURL(/kind=Pod/)

  // Action 2: Verify list loads
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByRole('row')).toHaveCount.greaterThan(1)

  // Action 3: Click on a specific resource
  await page.getByRole('link', { name: 'nginx-pod' }).click()

  // Action 4: Verify details page
  await expect(page.getByRole('heading', { name: 'nginx-pod' })).toBeVisible()
})

// BAD: Separate tests for each element
test('sidebar has Pod button', ...)
test('clicking Pod updates URL', ...)
test('table is visible', ...)
test('rows exist', ...)
```

12. **Use `beforeEach` for common setup** (login, navigation to starting point)

13. **Prefer extending existing `test.describe` blocks** when the feature fits

### Phase 6: Run and Verify

14. **Run the tests**:
   ```bash
   npx playwright test e2e/[file].spec.ts --reporter=line
   ```

15. **If tests fail**, analyze the error and fix:
   - Check if selectors need adjustment
   - Verify mock data matches expected values
   - Ensure proper wait conditions

16. **Report results** to the user:
   - Tests passed/failed
   - Coverage added
   - Any issues encountered

## Test Writing Guidelines

### Selectors (in order of preference)
1. `getByRole()` - Most reliable, semantic
2. `getByLabel()` - For form fields
3. `getByText()` - For static text
4. `getByTestId()` - Last resort, requires code changes

### Assertions
- Use `toBeVisible()` for elements that should be seen
- Use `toBeAttached()` for elements in DOM but possibly hidden
- Use `toHaveURL()` for navigation verification
- Use `toHaveCount()` for lists/tables
- Use `toContainText()` for partial text matching

### Handling Async
- Playwright auto-waits, but use explicit waits when needed:
  ```typescript
  await expect(page.getByRole('table')).toBeVisible()
  // Now table is definitely visible before next action
  ```

### Mock Data Awareness
- Tests run against mock server data
- Don't assert on specific counts unless mock data is deterministic
- Prefer assertions like "at least one" over exact counts when possible

## Example Invocation

User: "I just finished implementing the resource detail page. Can you generate tests for it?"

Claude would then:
1. Use Playwright MCP to navigate to the dashboard
2. Click through to a resource detail page
3. Capture the page structure
4. Check existing tests in `e2e/dashboard.spec.ts`
5. Propose extending the "clicking resource kind shows resource list" test to include clicking through to details
6. Wait for approval
7. Implement and run the tests
