import { test, expect } from '@playwright/test'
import { injectAuth } from './helpers'

test.describe('Unified Search', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test.describe('Search UI elements', () => {
    test('header shows scope selector, search input, and submit button', async ({ page }) => {
      // Scope selector with default "Both"
      const scopeSelect = page.getByLabel('Search scope')
      await expect(scopeSelect).toBeVisible()
      await expect(scopeSelect).toHaveValue('both')

      // Search input
      const searchInput = page.getByPlaceholder('Search resources & knowledge...')
      await expect(searchInput).toBeVisible()

      // Submit button (disabled when empty)
      const submitButton = page.getByRole('button', { name: 'Search' })
      await expect(submitButton).toBeVisible()
      await expect(submitButton).toBeDisabled()
    })

    test('submit button enables when search input has text', async ({ page }) => {
      const searchInput = page.getByPlaceholder('Search resources & knowledge...')
      const submitButton = page.getByRole('button', { name: 'Search', exact: true })

      await searchInput.fill('test query')
      await expect(submitButton).toBeEnabled()
    })

    test('header is ordered: Logo, Namespace, Search', async ({ page }) => {
      // Verify namespace selector appears before search input in the DOM
      const header = page.locator('header')
      const namespaceSelect = header.locator('#namespace-select')
      const searchInput = header.getByPlaceholder('Search resources & knowledge...')

      await expect(namespaceSelect).toBeVisible()
      await expect(searchInput).toBeVisible()

      // Namespace should come before search in DOM order
      const nsBoundingBox = await namespaceSelect.boundingBox()
      const searchBoundingBox = await searchInput.boundingBox()
      expect(nsBoundingBox).not.toBeNull()
      expect(searchBoundingBox).not.toBeNull()
      expect(nsBoundingBox!.x).toBeLessThan(searchBoundingBox!.x)
    })
  })

  test.describe('Search with Both scope (default)', () => {
    test('shows knowledge answer and resource results', async ({ page }) => {
      const searchInput = page.getByPlaceholder('Search resources & knowledge...')
      await searchInput.fill('RBAC policies')
      await searchInput.press('Enter')

      // Knowledge section appears
      await expect(page.getByRole('heading', { name: 'Knowledge Base' })).toBeVisible()
      // AI-synthesized answer contains expected text from mock
      await expect(page.getByText('RBAC policies in Kubernetes')).toBeVisible()

      // Resource results section appears
      await expect(page.getByRole('heading', { name: 'Search Results' })).toBeVisible()
    })
  })

  test.describe('Search with Knowledge scope', () => {
    test('shows only knowledge results, no resource table', async ({ page }) => {
      // Switch scope to Knowledge
      await page.getByLabel('Search scope').selectOption('knowledge')

      const searchInput = page.getByPlaceholder('Search resources & knowledge...')
      await searchInput.fill('RBAC policies')
      await searchInput.press('Enter')

      // Knowledge section appears
      await expect(page.getByRole('heading', { name: 'Knowledge Base' })).toBeVisible()
      await expect(page.getByText('RBAC policies in Kubernetes')).toBeVisible()

      // Resource results should NOT appear
      await expect(page.getByRole('heading', { name: 'Search Results' })).not.toBeVisible()
    })
  })

  test.describe('Search with Resources scope', () => {
    test('shows only resource results, no knowledge section', async ({ page }) => {
      // Switch scope to Resources
      await page.getByLabel('Search scope').selectOption('resources')

      const searchInput = page.getByPlaceholder('Search resources & knowledge...')
      await searchInput.fill('nginx')
      await searchInput.press('Enter')

      // Resource results appear
      await expect(page.getByRole('heading', { name: 'Search Results' })).toBeVisible()

      // Knowledge section should NOT appear
      await expect(page.getByRole('heading', { name: 'Knowledge Base' })).not.toBeVisible()
    })
  })

  test.describe('Submit mechanisms', () => {
    test('Enter key submits search', async ({ page }) => {
      const searchInput = page.getByPlaceholder('Search resources & knowledge...')
      await searchInput.fill('test query')
      await searchInput.press('Enter')

      // Should see results (knowledge section from default "both" scope)
      await expect(page.getByRole('heading', { name: 'Knowledge Base' })).toBeVisible()
    })

    test('submit button click submits search', async ({ page }) => {
      const searchInput = page.getByPlaceholder('Search resources & knowledge...')
      await searchInput.fill('test query')
      await page.getByRole('button', { name: 'Search', exact: true }).click()

      // Should see results
      await expect(page.getByRole('heading', { name: 'Knowledge Base' })).toBeVisible()
    })
  })

  test.describe('Knowledge results rendering', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByLabel('Search scope').selectOption('knowledge')
      const searchInput = page.getByPlaceholder('Search resources & knowledge...')
      await searchInput.fill('RBAC')
      await searchInput.press('Enter')
      await expect(page.getByRole('heading', { name: 'Knowledge Base' })).toBeVisible()
    })

    test('displays AI-synthesized answer with markdown', async ({ page }) => {
      // The mock answer mentions Role, RoleBinding, ClusterRole
      await expect(page.getByText('Role and RoleBinding resources')).toBeVisible()
    })

    test('displays source links', async ({ page }) => {
      // Sources heading
      await expect(page.getByRole('heading', { name: 'Sources' })).toBeVisible()
      // Source links from mock data
      await expect(page.getByRole('link', { name: 'RBAC Configuration Guide' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Security Best Practices' })).toBeVisible()
    })

    test('source links open in new tab', async ({ page }) => {
      const sourceLink = page.getByRole('link', { name: 'RBAC Configuration Guide' })
      await expect(sourceLink).toHaveAttribute('target', '_blank')
      await expect(sourceLink).toHaveAttribute('rel', /noopener/)
    })

    test('shows collapsible raw chunks', async ({ page }) => {
      // Chunks toggle button shows count
      const chunksToggle = page.getByRole('button', { name: /Raw Chunks \(3\)/ })
      await expect(chunksToggle).toBeVisible()

      // Chunks are collapsed by default - content not visible
      await expect(page.getByText('Role-based access control (RBAC) is managed through')).not.toBeVisible()

      // Expand chunks
      await chunksToggle.click()

      // Chunk content now visible
      await expect(page.getByText('Role-based access control (RBAC) is managed through')).toBeVisible()

      // Relevance scores visible (95%, 91%, 82% from mock)
      await expect(page.getByText('95%')).toBeVisible()
      await expect(page.getByText('91%')).toBeVisible()
      await expect(page.getByText('82%')).toBeVisible()

      // Collapse chunks again
      await chunksToggle.click()
      await expect(page.getByText('Role-based access control (RBAC) is managed through')).not.toBeVisible()
    })
  })

  test.describe('Resource search results', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByLabel('Search scope').selectOption('resources')
      const searchInput = page.getByPlaceholder('Search resources & knowledge...')
      await searchInput.fill('nginx')
      await searchInput.press('Enter')
      await expect(page.getByRole('heading', { name: 'Search Results' })).toBeVisible()
    })

    test('displays results grouped by resource kind', async ({ page }) => {
      // Mock returns nginx Deployment and nginx Service
      await expect(page.getByRole('heading', { name: /Deployment/ })).toBeVisible()
      await expect(page.getByRole('heading', { name: /Service/ })).toBeVisible()
    })

    test('shows relevance scores', async ({ page }) => {
      // Mock returns scores like 95%, 91% etc.
      await expect(page.getByText('95%').first()).toBeVisible()
    })

    test('shows result table with expected columns', async ({ page }) => {
      await expect(page.getByRole('columnheader', { name: 'Name' }).first()).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Relevance' }).first()).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Namespace' }).first()).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Age' }).first()).toBeVisible()
    })

    test('shows min relevance filter', async ({ page }) => {
      const relevanceFilter = page.getByLabel('Min relevance:')
      await expect(relevanceFilter).toBeVisible()
      // Default is 50%
      await expect(relevanceFilter).toHaveValue('0.5')
    })
  })

  test.describe('Scope switching', () => {
    test('switching scope updates results without resubmitting', async ({ page }) => {
      // Submit search with Both scope
      const searchInput = page.getByPlaceholder('Search resources & knowledge...')
      await searchInput.fill('test')
      await searchInput.press('Enter')

      // Both sections visible
      await expect(page.getByRole('heading', { name: 'Knowledge Base' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Search Results' })).toBeVisible()

      // Switch to Knowledge only
      await page.getByLabel('Search scope').selectOption('knowledge')
      await expect(page.getByRole('heading', { name: 'Knowledge Base' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Search Results' })).not.toBeVisible()

      // Switch to Resources only
      await page.getByLabel('Search scope').selectOption('resources')
      await expect(page.getByRole('heading', { name: 'Search Results' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Knowledge Base' })).not.toBeVisible()
    })
  })

  test.describe('URL bookmarking', () => {
    test('search query and scope persist in URL', async ({ page }) => {
      const searchInput = page.getByPlaceholder('Search resources & knowledge...')
      await searchInput.fill('RBAC')
      await searchInput.press('Enter')

      // URL should contain q=RBAC
      await expect(page).toHaveURL(/q=RBAC/)

      // Switch scope to knowledge
      await page.getByLabel('Search scope').selectOption('knowledge')
      await expect(page).toHaveURL(/scope=knowledge/)
    })

    test('both scope omits scope param from URL', async ({ page }) => {
      const searchInput = page.getByPlaceholder('Search resources & knowledge...')
      await searchInput.fill('test')
      await searchInput.press('Enter')

      // Default "both" should not add scope param
      const url = page.url()
      expect(url).toContain('q=test')
      expect(url).not.toContain('scope=')
    })

    test('loading page with search params restores search state', async ({ page }) => {
      // Navigate directly with search params
      // sessionStorage persists across same-origin page.goto() within the same tab
      await page.goto('/dashboard?q=RBAC&scope=knowledge')

      // Search input should have the query
      const searchInput = page.getByPlaceholder('Search resources & knowledge...')
      await expect(searchInput).toHaveValue('RBAC')

      // Scope should be set to knowledge
      await expect(page.getByLabel('Search scope')).toHaveValue('knowledge')

      // Knowledge results should display
      await expect(page.getByRole('heading', { name: 'Knowledge Base' })).toBeVisible()
    })
  })

  test.describe('Clear search', () => {
    test('clear button resets search and returns to dashboard home', async ({ page }) => {
      const searchInput = page.getByPlaceholder('Search resources & knowledge...')
      await searchInput.fill('RBAC')
      await searchInput.press('Enter')

      // Verify search results are showing
      await expect(page.getByRole('heading', { name: 'Knowledge Base' })).toBeVisible()

      // Click clear button
      await page.getByLabel('Clear search').click()

      // Search input should be empty
      await expect(searchInput).toHaveValue('')

      // Knowledge results should disappear
      await expect(page.getByRole('heading', { name: 'Knowledge Base' })).not.toBeVisible()

      // URL should not have search param
      const url = page.url()
      expect(url).not.toContain('q=')
    })
  })
})
