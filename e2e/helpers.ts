import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/** Name of the HttpOnly session cookie on plain HTTP (see server/auth/session.ts). */
export const SESSION_COOKIE = 'dot-ai-ui-session'

/**
 * Build a mock JWT with a future expiry for test authentication.
 * The Express server passes JWTs through to the (mock) dot-ai server, which
 * accepts them, and /api/v1/auth/session reports them as an OAuth session.
 * Using a cookie avoids the rate-limited login endpoint in every test.
 */
export function buildTestJwt(email = 'test@dot-ai.local'): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    sub: 'test-user',
    email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url')
  return `${header}.${payload}.mock-signature`
}

/**
 * Authenticate the browser context the way the OAuth callback does: by
 * setting the HttpOnly session cookie. Must be called before page.goto().
 */
export async function injectAuth(page: Page): Promise<void> {
  await page.context().addCookies([
    {
      name: SESSION_COOKIE,
      value: buildTestJwt(),
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Strict',
    },
  ])
}

/**
 * Login via the UI login form. Use only for tests that specifically test the login flow.
 */
export async function loginWithToken(page: Page, token = 'test-token'): Promise<void> {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'DevOps AI Toolkit' })).toBeVisible({ timeout: 10000 })

  // The Token tab only exists when SSO is also offered
  const tokenTab = page.getByRole('tab', { name: 'Token' })
  if (await tokenTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await tokenTab.click()
  }

  const tokenInput = page.getByLabel('Access Token')
  await expect(tokenInput).toBeVisible({ timeout: 5000 })

  await tokenInput.fill(token)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
}
