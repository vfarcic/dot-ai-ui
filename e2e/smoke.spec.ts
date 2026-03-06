import { test, expect } from '@playwright/test'

test.describe('App smoke tests', () => {
  test('app loads and shows login page', async ({ page }) => {
    await page.goto('/')

    // Verify the app renders and shows the login page (unauthenticated state)
    await expect(page.getByRole('heading', { name: 'DevOps AI Toolkit' })).toBeVisible()

    // Login page may show SSO or Token mode depending on OAuth availability
    const ssoButton = page.getByRole('button', { name: 'Login with SSO' })
    const tokenInput = page.getByLabel('Access Token')
    await expect(ssoButton.or(tokenInput)).toBeVisible()
  })

  test('page has correct title', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle('DevOps AI Toolkit')
  })
})
