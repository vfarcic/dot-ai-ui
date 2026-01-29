import { test, expect } from '@playwright/test'

test.describe('App smoke tests', () => {
  test('app loads and shows login page', async ({ page }) => {
    await page.goto('/')

    // Verify the app renders and shows the login page (unauthenticated state)
    await expect(page.getByRole('heading', { name: 'DevOps AI Toolkit' })).toBeVisible()
    await expect(page.getByLabel('Access Token')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  })

  test('page has correct title', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle('DevOps AI Toolkit')
  })
})
