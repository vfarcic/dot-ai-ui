import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/')
    await page.getByLabel('Access Token').fill('test-token')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('sidebar shows resource kinds grouped by API', async ({ page }) => {
    // Verify sidebar renders with API groups
    await expect(page.getByRole('button', { name: /^core/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^apps/ })).toBeVisible()

    // Verify core group is expanded and shows resource kinds
    await expect(page.getByRole('button', { name: 'Pod', exact: false })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Service', exact: false })).toBeVisible()
  })

  test('namespace dropdown has options', async ({ page }) => {
    const namespaceDropdown = page.getByRole('combobox', { name: 'Namespace:' })
    await expect(namespaceDropdown).toBeVisible()

    // Verify some expected namespaces from mock data
    await expect(namespaceDropdown.getByRole('option', { name: 'All Namespaces' })).toBeAttached()
    await expect(namespaceDropdown.getByRole('option', { name: 'default' })).toBeAttached()
    await expect(namespaceDropdown.getByRole('option', { name: 'kube-system' })).toBeAttached()
  })

  test('clicking resource kind shows resource list', async ({ page }) => {
    // Click on Pod in sidebar
    await page.getByRole('button', { name: 'Pod', exact: false }).click()

    // Verify URL updated
    await expect(page).toHaveURL(/kind=Pod/)

    // Verify resource table appears with headers
    await expect(page.getByRole('heading', { name: 'Pod' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Name', exact: true })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Namespace' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible()

    // Verify at least one resource row appears (from mock data)
    await expect(page.getByRole('row').filter({ hasText: 'Running' })).toHaveCount(3)
  })
})
