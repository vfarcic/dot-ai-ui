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

/**
 * Security regression: /api/v1/auth/verify must not trust unverified JWTs.
 *
 * The endpoint previously treated any token containing a "." as a trusted
 * OAuth JWT and returned authenticated:true after decoding its payload with no
 * signature check — letting a forged alg:none token spoof the UI's auth state.
 * The dot-ai backend is the sole authority on JWT validity, so /verify must
 * only authenticate the static bearer token (DOT_AI_UI_AUTH_TOKEN = "test-token"
 * in this suite) and reject everything else with 401.
 */
test.describe('auth/verify endpoint security', () => {
  // Forged JWT with alg:none and a forged identity, empty signature.
  const forgedNoneJwt = (() => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({
      sub: 'attacker',
      email: 'attacker@evil.example',
      exp: 1900000000,
    })).toString('base64url')
    return `${header}.${payload}.`
  })()

  test('rejects a forged alg:none JWT with 401', async ({ request }) => {
    const res = await request.get('/api/v1/auth/verify', {
      headers: { Authorization: `Bearer ${forgedNoneJwt}` },
    })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.authenticated).toBe(false)
  })

  test('rejects a non-JWT invalid token with 401', async ({ request }) => {
    const res = await request.get('/api/v1/auth/verify', {
      headers: { Authorization: 'Bearer invalidtoken123' },
    })
    expect(res.status()).toBe(401)
  })

  test('accepts the configured static bearer token', async ({ request }) => {
    const res = await request.get('/api/v1/auth/verify', {
      headers: { Authorization: 'Bearer test-token' },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.authenticated).toBe(true)
    expect(body.authMode).toBe('token')
  })
})
