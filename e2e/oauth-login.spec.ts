import { test, expect } from './fixtures'
import type { BrowserContext, Page } from '@playwright/test'
import { loginWithToken, SESSION_COOKIE } from './helpers'

/** Everything page script could read: document.cookie plus both Web Storage areas. */
async function scriptVisibleState(page: Page): Promise<string> {
  return page.evaluate(() => {
    const dump = (s: Storage) => Object.keys(s).map((k) => `${k}=${s.getItem(k)}`).join('\n')
    return [document.cookie, dump(sessionStorage), dump(localStorage)].join('\n')
  })
}

async function sessionCookie(context: BrowserContext) {
  return (await context.cookies()).find((c) => c.name === SESSION_COOKIE)
}

test.describe('OAuth login flow', () => {
  test('login page shows SSO button', async ({ page }) => {
    await page.goto('/')

    // SSO button must be visible — mock server provides OAuth registration
    const ssoButton = page.getByRole('button', { name: 'Login with SSO' })
    await expect(ssoButton).toBeVisible()
  })

  test('SSO callback sets an HttpOnly cookie, keeps the token out of URLs and script, and survives reload', async ({ page, context }) => {
    // Record every URL the browser requests so we can prove the token never rides in one
    const requestedUrls: string[] = []
    page.on('request', (r) => requestedUrls.push(r.url()))

    await page.goto('/')
    await page.getByRole('button', { name: 'Login with SSO' }).click()

    // Real flow: /auth/login -> mock /authorize -> /auth/callback (server-side code
    // exchange with the mock /token) -> Set-Cookie -> /dashboard
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15000 })
    await expect(page.getByText('admin@dot-ai.local')).toBeVisible()

    expect(requestedUrls.some((u) => u.includes('/auth/callback?code='))).toBe(true)

    const cookie = await sessionCookie(context)
    expect(cookie).toBeDefined()
    expect(cookie!.httpOnly).toBe(true)
    expect(cookie!.sameSite).toBe('Strict')
    expect(cookie!.path).toBe('/')
    expect(cookie!.expires).toBeGreaterThan(Date.now() / 1000)

    const token = cookie!.value
    for (const url of requestedUrls) {
      expect(url).not.toContain(token)
      expect(url).not.toContain('#token=')
    }
    expect(await scriptVisibleState(page)).not.toContain(token)

    // Authenticated API calls work with only the cookie
    await expect(page.getByRole('button', { name: /^core/ })).toBeVisible()

    // Reload keeps the session (cookie, not tab storage)
    await page.reload()
    await expect(page.getByText('admin@dot-ai.local')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Login with SSO' })).toHaveCount(0)
  })

  test('signing out clears the session cookie', async ({ page, context }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Login with SSO' }).click()
    await expect(page.getByText('admin@dot-ai.local')).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: 'admin@dot-ai.local' }).click()
    await page.getByRole('button', { name: 'Sign Out' }).click()

    await expect(page.getByRole('button', { name: 'Login with SSO' })).toBeVisible()
    expect(await sessionCookie(context)).toBeUndefined()

    // Still signed out after reload
    await page.reload()
    await expect(page.getByRole('button', { name: 'Login with SSO' })).toBeVisible()
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

test.describe('Token login', () => {
  test('token sign-in stores the credential only in an HttpOnly cookie and survives reload', async ({ page, context }) => {
    await loginWithToken(page, 'test-token')

    // Dashboard data loads through the proxy with only the cookie
    await expect(page.getByRole('button', { name: /^core/ })).toBeVisible()

    const cookie = await sessionCookie(context)
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.sameSite).toBe('Strict')
    expect(await scriptVisibleState(page)).not.toContain('test-token')

    await page.reload()
    await expect(page.getByRole('button', { name: /^core/ })).toBeVisible()
    await expect(page.getByLabel('Access Token')).toHaveCount(0)
  })

  test('a wrong token shows an error and sets no cookie', async ({ page, context }) => {
    await page.goto('/')
    await page.getByRole('tab', { name: 'Token' }).click()
    await page.getByLabel('Access Token').fill('wrong-token')
    await page.getByRole('button', { name: 'Sign In' }).click()

    await expect(page.getByText('Invalid token')).toBeVisible()
    expect(await sessionCookie(context)).toBeUndefined()
  })
})

test.describe('Session and CSRF endpoints', () => {
  test('session endpoint reports signed-out without a cookie', async ({ request }) => {
    const res = await request.get('/api/v1/auth/session')
    expect(res.status()).toBe(200)
    expect(await res.json()).toEqual({ authenticated: false, authEnabled: true })
  })

  test('cross-site state-changing requests are rejected', async ({ request }) => {
    const login = await request.post('/api/v1/auth/login', {
      headers: { Origin: 'https://evil.example' },
      data: { token: 'test-token' },
    })
    expect(login.status()).toBe(403)

    const mutate = await request.post('/api/v1/users', {
      headers: {
        'Sec-Fetch-Site': 'cross-site',
        Cookie: `${SESSION_COOKIE}=test-token`,
      },
      data: { email: 'csrf@evil.example', password: 'x' },
    })
    expect(mutate.status()).toBe(403)
  })
})
