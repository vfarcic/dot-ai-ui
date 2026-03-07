import { test, expect } from '@playwright/test'

/**
 * Helper to build a mock JWT with a future expiry.
 */
function buildMockJwt(): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    sub: '00000000-0000-0000-0000-000000000001',
    email: 'admin@dot-ai.local',
    groups: [],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url')
  return `${header}.${payload}.mock-signature`
}

test.describe('OAuth login flow', () => {
  test('login page shows SSO button', async ({ page }) => {
    await page.goto('/')

    // SSO button must be visible — mock server provides OAuth registration
    const ssoButton = page.getByRole('button', { name: 'Login with SSO' })
    await expect(ssoButton).toBeVisible()
  })

  test('SSO login flow stores token and redirects to dashboard', async ({ page }) => {
    const mockJwt = buildMockJwt()

    // Intercept /auth/login to simulate the full OAuth flow:
    // Instead of following the real redirect chain (Express → MCP → Dex → callback),
    // we short-circuit to /auth/complete with a mock JWT token.
    await page.route('**/auth/login', async (route) => {
      await route.fulfill({
        status: 302,
        headers: { location: `/auth/complete#token=${mockJwt}` },
      })
    })

    await page.goto('/')

    // Click the SSO button to initiate login
    const ssoButton = page.getByRole('button', { name: 'Login with SSO' })
    await expect(ssoButton).toBeVisible()
    await ssoButton.click()

    // Should land on the dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })

    // User email from JWT should be displayed in the sidebar
    await expect(page.getByText('admin@dot-ai.local')).toBeVisible()
  })

  test('switching to Token tab shows token input', async ({ page }) => {
    await page.goto('/')

    // Wait for the login page to fully render
    await expect(page.getByRole('heading', { name: 'DevOps AI Toolkit' })).toBeVisible()

    // Switch to Token mode
    const tokenTab = page.getByRole('tab', { name: 'Token' })
    await expect(tokenTab).toBeVisible()
    await tokenTab.click()

    // Token input should appear
    await expect(page.getByLabel('Access Token')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  })
})
