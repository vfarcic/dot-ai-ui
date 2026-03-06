import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * Build a mock JWT with a future expiry for test authentication.
 * The frontend trusts OAuth JWTs without calling /verify — it only checks
 * expiry client-side. This avoids hitting the auth rate limiter.
 */
function buildTestJwt(): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({
    sub: 'test-user',
    email: 'test@dot-ai.local',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  }))
  return `${header}.${payload}.mock-signature`
}

/**
 * Inject auth into sessionStorage so the app treats the user as authenticated.
 * Uses a mock OAuth JWT so the frontend skips the /verify call entirely
 * (OAuth tokens are trusted client-side per the auth architecture).
 * Must be called before page.goto().
 */
export async function injectAuth(page: Page): Promise<void> {
  const jwt = buildTestJwt()
  await page.addInitScript((token) => {
    sessionStorage.setItem('dot-ai-ui-auth-token', token)
    sessionStorage.setItem('dot-ai-ui-auth-mode', 'oauth')
    sessionStorage.setItem('dot-ai-ui-user-email', 'test@dot-ai.local')
  }, jwt)
}

/**
 * Login via the UI login form. Use only for tests that specifically test the login flow.
 */
export async function loginWithToken(page: Page, token = 'test-token'): Promise<void> {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'DevOps AI Toolkit' })).toBeVisible({ timeout: 10000 })

  const tokenTab = page.getByRole('button', { name: 'Token' })
  if (await tokenTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await tokenTab.click()
  }

  const tokenInput = page.getByLabel('Access Token')
  await expect(tokenInput).toBeVisible({ timeout: 5000 })

  await tokenInput.fill(token)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
}
