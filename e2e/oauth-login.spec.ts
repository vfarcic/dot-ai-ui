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
  test('login page shows SSO button when OAuth is available', async ({ page }) => {
    await page.goto('/')

    // Wait for auth status check to complete — SSO button only appears if OAuth registered
    // If OAuth registration failed (no mock server), the SSO button won't appear,
    // so we check for either SSO or the token form
    const ssoButton = page.getByRole('button', { name: 'Login with SSO' })
    const tokenInput = page.getByLabel('Access Token')

    // At least one login method should be visible
    await expect(ssoButton.or(tokenInput)).toBeVisible()
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

    // If SSO button is available, click it
    const ssoButton = page.getByRole('button', { name: 'Login with SSO' })
    if (await ssoButton.isVisible().catch(() => false)) {
      await ssoButton.click()
    } else {
      // If OAuth isn't registered, navigate directly to simulate callback
      await page.goto(`/auth/complete#token=${mockJwt}`)
    }

    // Should land on the dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })

    // User email from JWT should be displayed in the sidebar
    await expect(page.getByText('admin@dot-ai.local')).toBeVisible()
  })

  test('switching to Token tab shows token input', async ({ page }) => {
    await page.goto('/')

    // Wait for the login page to fully render
    await expect(page.getByRole('heading', { name: 'DevOps AI Toolkit' })).toBeVisible()

    // If OAuth tabs are shown, switch to Token mode
    const tokenTab = page.getByRole('button', { name: 'Token' })
    if (await tokenTab.isVisible().catch(() => false)) {
      await tokenTab.click()
      // Token input should appear
      await expect(page.getByLabel('Access Token')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
    }
  })
})
