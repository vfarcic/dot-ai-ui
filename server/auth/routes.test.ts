// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import express from 'express'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

// bearer.ts reads the static token when it is first imported
vi.hoisted(() => {
  process.env.DOT_AI_UI_AUTH_TOKEN = 'unit-static-token'
})

const oauthMocks = vi.hoisted(() => ({
  exchangeCode: vi.fn(),
  ensureRegistered: vi.fn(),
  buildAuthorizeUrl: vi.fn(),
}))
vi.mock('./oauth-client.js', () => oauthMocks)

import {
  authMiddleware,
  createAuthApiRouter,
  csrfProtection,
  getRequestCredential,
  describeSession,
} from './index.js'
import { createOAuthRouter } from './oauth-routes.js'
import {
  SESSION_COOKIE,
  SECURE_SESSION_COOKIE,
  OAUTH_STATE_COOKIE,
  SECURE_OAUTH_STATE_COOKIE,
} from './session.js'

const STATIC = 'unit-static-token'
const passthrough: express.RequestHandler = (_req, _res, next) => next()

function jwt(payload: Record<string, unknown>): string {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc(payload)}.sig`
}

/** Mirrors the wiring in server/index.ts */
function buildApp(): express.Express {
  const app = express()
  app.set('trust proxy', 1)
  app.use(express.json())
  app.use(createOAuthRouter())
  app.use('/api/v1', csrfProtection)
  app.use('/api/v1/auth', createAuthApiRouter({ authLimiter: passthrough, apiLimiter: passthrough }))
  app.use('/api/v1', authMiddleware)
  app.get('/api/v1/whoami', (req, res) => {
    const credential = getRequestCredential(req)
    res.json({ hasCredential: Boolean(credential), jwt: Boolean(credential?.includes('.')) })
  })
  app.post('/api/v1/mutate', (_req, res) => {
    res.json({ ok: true })
  })
  return app
}

let server: Server
let base: string

beforeAll(async () => {
  server = buildApp().listen(0)
  await new Promise<void>((resolve) => server.once('listening', () => resolve()))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

beforeEach(() => {
  oauthMocks.exchangeCode.mockReset()
  delete process.env.DOT_AI_UI_SECURE_COOKIES
})

/** The binding cookie /auth/login gives the browser that starts a login */
const STATE_COOKIE = (state: string) => `${OAUTH_STATE_COOKIE}=${state}`

function req(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${base}${path}`, { redirect: 'manual', ...init })
}

function jsonPost(path: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return req(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

/** Set-Cookie headers that set (not clear) a session cookie */
function sessionCookiesSet(res: Response): string[] {
  return res.headers
    .getSetCookie()
    .filter((c) => c.startsWith(`${SESSION_COOKIE}=`) || c.startsWith(`${SECURE_SESSION_COOKIE}=`))
    .filter((c) => !c.includes('Max-Age=0'))
}

/** name=value of the first Set-Cookie, for sending back as a Cookie header */
function cookiePair(res: Response): string {
  return res.headers.getSetCookie()[0].split(';')[0]
}

describe('POST /api/v1/auth/login', () => {
  it('sets an HttpOnly SameSite=Strict cookie for the static token and never echoes it', async () => {
    const res = await jsonPost('/api/v1/auth/login', { token: STATIC })
    expect(res.status).toBe(200)

    const body = await res.text()
    expect(body).not.toContain(STATIC)
    expect(JSON.parse(body)).toEqual({ authenticated: true, authEnabled: true, mode: 'token' })

    const [cookie] = res.headers.getSetCookie()
    expect(cookie).toMatch(new RegExp(`^${SESSION_COOKIE}=`))
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Strict')
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain('Max-Age=28800')
    expect(cookie).not.toContain('Secure') // plain HTTP (dev / E2E on localhost)
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('uses a __Host- Secure cookie when the request arrived over HTTPS', async () => {
    const res = await jsonPost('/api/v1/auth/login', { token: STATIC }, { 'X-Forwarded-Proto': 'https' })
    const [cookie] = res.headers.getSetCookie()
    expect(cookie).toMatch(new RegExp(`^${SECURE_SESSION_COOKIE}=`))
    expect(cookie).toContain('; Secure')
  })

  it('rejects a wrong token with 401 and no cookie', async () => {
    const res = await jsonPost('/api/v1/auth/login', { token: 'nope' })
    expect(res.status).toBe(401)
    expect(res.headers.getSetCookie()).toEqual([])
    expect(await res.json()).toEqual({ authenticated: false, error: 'Invalid token' })
  })

  it('rejects an empty or missing token with 400', async () => {
    expect((await jsonPost('/api/v1/auth/login', { token: '  ' })).status).toBe(400)
    expect((await jsonPost('/api/v1/auth/login', {})).status).toBe(400)
  })

  it('does not accept a JWT as a static-token login', async () => {
    const res = await jsonPost('/api/v1/auth/login', { token: jwt({ email: 'x@y' }) })
    expect(res.status).toBe(401)
  })

  it('is blocked when issued cross-site (login CSRF)', async () => {
    const res = await jsonPost('/api/v1/auth/login', { token: STATIC }, { Origin: 'https://evil.example' })
    expect(res.status).toBe(403)
    expect(res.headers.getSetCookie()).toEqual([])
  })
})

describe('GET /api/v1/auth/session', () => {
  it('reports unauthenticated without a cookie', async () => {
    const res = await req('/api/v1/auth/session')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ authenticated: false, authEnabled: true })
    expect(res.headers.getSetCookie()).toEqual([])
  })

  it('reports a static-token session from the cookie set by login', async () => {
    const login = await jsonPost('/api/v1/auth/login', { token: STATIC })
    const res = await req('/api/v1/auth/session', { headers: { Cookie: cookiePair(login) } })
    expect(await res.json()).toEqual({ authenticated: true, authEnabled: true, mode: 'token' })
  })

  it('reports an OAuth session with email and expiry, without the token', async () => {
    const token = jwt({ email: 'dev@example.com', exp: 2_000_000_000 })
    const res = await req('/api/v1/auth/session', { headers: { Cookie: `${SESSION_COOKIE}=${token}` } })
    const body = await res.text()
    expect(body).not.toContain(token)
    expect(JSON.parse(body)).toEqual({
      authenticated: true,
      authEnabled: true,
      mode: 'oauth',
      email: 'dev@example.com',
      expiresAt: 2_000_000_000_000,
    })
  })

  it('clears a cookie that no longer holds a valid credential', async () => {
    const res = await req('/api/v1/auth/session', { headers: { Cookie: `${SESSION_COOKIE}=rotated-token` } })
    expect((await res.json()).authenticated).toBe(false)
    const cleared = res.headers.getSetCookie()
    expect(cleared.some((c) => c.startsWith(`${SESSION_COOKIE}=;`) && c.includes('Max-Age=0'))).toBe(true)
  })

  it('does not clear a valid cookie because of a bad Authorization header', async () => {
    const res = await req('/api/v1/auth/session', {
      headers: { Cookie: `${SESSION_COOKIE}=${STATIC}`, Authorization: 'Bearer wrong' },
    })
    expect((await res.json()).authenticated).toBe(false)
    expect(res.headers.getSetCookie()).toEqual([])
  })

  it('treats an undecodable JWT-shaped cookie as signed out', () => {
    expect(describeSession('a.b.c')).toEqual({ authenticated: false, authEnabled: true })
  })
})

describe('POST /api/v1/auth/logout', () => {
  it('clears the session cookie (both names on HTTPS)', async () => {
    const res = await req('/api/v1/auth/logout', {
      method: 'POST',
      headers: { 'X-Forwarded-Proto': 'https', Cookie: `${SECURE_SESSION_COOKIE}=${STATIC}` },
    })
    expect(res.status).toBe(200)
    const cookies = res.headers.getSetCookie()
    expect(cookies).toHaveLength(2)
    expect(cookies[0]).toMatch(new RegExp(`^${SECURE_SESSION_COOKIE}=; .*Max-Age=0.*Secure`))
    expect(cookies[1]).toMatch(new RegExp(`^${SESSION_COOKIE}=; .*Max-Age=0`))
  })

  it('is blocked cross-site', async () => {
    const res = await req('/api/v1/auth/logout', { method: 'POST', headers: { 'Sec-Fetch-Site': 'cross-site' } })
    expect(res.status).toBe(403)
  })
})

describe('protected API with the session cookie', () => {
  it('rejects requests without a credential', async () => {
    const res = await req('/api/v1/whoami')
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Authentication required')
  })

  it('accepts the static-token cookie', async () => {
    const res = await req('/api/v1/whoami', { headers: { Cookie: `${SESSION_COOKIE}=${STATIC}` } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ hasCredential: true, jwt: false })
  })

  it('rejects a wrong static-token cookie', async () => {
    const res = await req('/api/v1/whoami', { headers: { Cookie: `${SESSION_COOKIE}=wrong` } })
    expect(res.status).toBe(401)
  })

  it('passes a JWT cookie through for the dot-ai server to validate', async () => {
    const res = await req('/api/v1/whoami', { headers: { Cookie: `${SESSION_COOKIE}=${jwt({ sub: 'u' })}` } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ hasCredential: true, jwt: true })
  })

  it('still accepts an Authorization header for API clients', async () => {
    const res = await req('/api/v1/whoami', { headers: { Authorization: `Bearer ${STATIC}` } })
    expect(res.status).toBe(200)
  })

  it('rejects a non-Bearer Authorization scheme', async () => {
    const res = await req('/api/v1/whoami', {
      headers: { Authorization: 'Basic abc', Cookie: `${SESSION_COOKIE}=${STATIC}` },
    })
    expect(res.status).toBe(401)
  })

  it('blocks cross-site state-changing requests even with a valid cookie', async () => {
    const cookie = `${SESSION_COOKIE}=${STATIC}`
    const cross = await req('/api/v1/mutate', { method: 'POST', headers: { Cookie: cookie, 'Sec-Fetch-Site': 'cross-site' } })
    expect(cross.status).toBe(403)
    const same = await req('/api/v1/mutate', { method: 'POST', headers: { Cookie: cookie, 'Sec-Fetch-Site': 'same-origin' } })
    expect(same.status).toBe(200)
  })

  it('/verify accepts the static token from header or cookie and rejects a JWT', async () => {
    expect((await req('/api/v1/auth/verify', { headers: { Authorization: `Bearer ${STATIC}` } })).status).toBe(200)
    expect((await req('/api/v1/auth/verify', { headers: { Cookie: `${SESSION_COOKIE}=${STATIC}` } })).status).toBe(200)
    expect((await req('/api/v1/auth/verify', { headers: { Authorization: `Bearer ${jwt({ alg: 'none' })}` } })).status)
      .toBe(401)
  })
})

describe('GET /auth/callback', () => {
  it('stores the access token in the cookie and redirects without it', async () => {
    const accessToken = jwt({ email: 'sso@example.com', exp: Math.floor(Date.now() / 1000) + 600 })
    oauthMocks.exchangeCode.mockResolvedValue({ accessToken, expiresIn: 3600 })

    const res = await req('/auth/callback?code=c&state=s', { headers: { Cookie: STATE_COOKIE('s') } })
    expect(oauthMocks.exchangeCode).toHaveBeenCalledWith('c', 's')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/dashboard')
    expect(res.headers.get('location')).not.toContain(accessToken)

    const setCookies = res.headers.getSetCookie()
    // The single-use state cookie is expired
    expect(setCookies.some((c) => c.startsWith(`${OAUTH_STATE_COOKIE}=;`) && c.includes('Max-Age=0'))).toBe(true)
    const cookie = setCookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`))!
    expect(cookie.startsWith(`${SESSION_COOKIE}=${accessToken};`)).toBe(true)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Strict')
    const maxAge = Number(/Max-Age=(\d+)/.exec(cookie)?.[1])
    expect(maxAge).toBeGreaterThan(590)
    expect(maxAge).toBeLessThanOrEqual(600)

    const session = await req('/api/v1/auth/session', { headers: { Cookie: cookie.split(';')[0] } })
    expect(await session.json()).toMatchObject({ authenticated: true, mode: 'oauth', email: 'sso@example.com' })
  })

  it('redirects with auth_error and no cookie when the exchange fails', async () => {
    oauthMocks.exchangeCode.mockRejectedValue(new Error('Invalid or expired state parameter'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await req('/auth/callback?code=c&state=bad', { headers: { Cookie: STATE_COOKIE('bad') } })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/dashboard?auth_error=Invalid%20or%20expired%20state%20parameter')
    expect(sessionCookiesSet(res)).toEqual([])
    errSpy.mockRestore()
  })

  it('refuses an access token that is not a JWT', async () => {
    oauthMocks.exchangeCode.mockResolvedValue({ accessToken: 'opaque', expiresIn: 3600 })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await req('/auth/callback?code=c&state=s', { headers: { Cookie: STATE_COOKIE('s') } })
    expect(res.headers.get('location')).toMatch(/^\/dashboard\?auth_error=/)
    expect(sessionCookiesSet(res)).toEqual([])
    errSpy.mockRestore()
  })

  it('returns 400 when code or state is missing', async () => {
    expect((await req('/auth/callback?code=c')).status).toBe(400)
  })

  it('refuses a code+state pair this browser did not start (login CSRF), leaving its session alone', async () => {
    const errSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const victimSession = `${SESSION_COOKIE}=${STATIC}`

    for (const cookie of [victimSession, `${victimSession}; ${STATE_COOKIE('someone-elses-state')}`]) {
      const res = await req('/auth/callback?code=attacker-code&state=attacker-state', { headers: { Cookie: cookie } })
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toMatch(/^\/dashboard\?auth_error=/)
      expect(sessionCookiesSet(res)).toEqual([])
    }
    expect(oauthMocks.exchangeCode).not.toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('on HTTPS only trusts the __Host- state cookie (a sibling subdomain could plant the plain one)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const accessToken = jwt({ email: 'sso@example.com' })
    oauthMocks.exchangeCode.mockResolvedValue({ accessToken, expiresIn: 3600 })

    const tossed = await req('/auth/callback?code=c&state=s', {
      headers: { 'X-Forwarded-Proto': 'https', Cookie: STATE_COOKIE('s') },
    })
    expect(tossed.headers.get('location')).toMatch(/auth_error=/)
    expect(oauthMocks.exchangeCode).not.toHaveBeenCalled()

    const ok = await req('/auth/callback?code=c&state=s', {
      headers: { 'X-Forwarded-Proto': 'https', Cookie: `${SECURE_OAUTH_STATE_COOKIE}=s` },
    })
    expect(ok.headers.get('location')).toBe('/dashboard')
    expect(ok.headers.getSetCookie().some((c) => c.startsWith(`${SECURE_SESSION_COOKIE}=${accessToken};`))).toBe(true)
    warnSpy.mockRestore()
  })

  it('expires the state cookie on an IdP error redirect too', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await req('/auth/callback?error=access_denied', { headers: { Cookie: STATE_COOKIE('s') } })
    expect(res.headers.get('location')).toBe('/dashboard?auth_error=access_denied')
    expect(res.headers.getSetCookie().some((c) => c.startsWith(`${OAUTH_STATE_COOKIE}=;`))).toBe(true)
    errSpy.mockRestore()
  })
})

describe('GET /auth/login', () => {
  beforeEach(() => {
    oauthMocks.ensureRegistered.mockReset().mockResolvedValue(undefined)
    oauthMocks.buildAuthorizeUrl.mockReset().mockReturnValue({
      authorizeUrl: 'http://idp.example/authorize?state=abc123',
      state: 'abc123',
    })
  })

  it('binds the state to this browser with a Lax HttpOnly cookie and redirects to the IdP', async () => {
    const res = await req('/auth/login')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('http://idp.example/authorize?state=abc123')
    const [cookie] = res.headers.getSetCookie()
    expect(cookie).toMatch(new RegExp(`^${OAUTH_STATE_COOKIE}=abc123; `))
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax') // the IdP return is a cross-site top-level navigation
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain('Max-Age=600')
    expect(cookie).not.toContain('Secure')
    expect(oauthMocks.ensureRegistered).toHaveBeenCalledWith(expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+\/auth\/callback$/))
  })

  it('uses a __Host- Secure state cookie on HTTPS', async () => {
    const res = await req('/auth/login', { headers: { 'X-Forwarded-Proto': 'https' } })
    const [cookie] = res.headers.getSetCookie()
    expect(cookie).toMatch(new RegExp(`^${SECURE_OAUTH_STATE_COOKIE}=abc123; `))
    expect(cookie).toContain('; Secure')
  })

  it('with DOT_AI_UI_SECURE_COOKIES=true registers an https callback even when the proxy hop says http', async () => {
    process.env.DOT_AI_UI_SECURE_COOKIES = 'true'
    const res = await req('/auth/login', { headers: { 'X-Forwarded-Proto': 'http' } })
    expect(res.headers.getSetCookie()[0]).toMatch(new RegExp(`^${SECURE_OAUTH_STATE_COOKIE}=`))
    expect(oauthMocks.ensureRegistered).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\//))
  })
})

describe('DOT_AI_UI_SECURE_COOKIES', () => {
  it('true: Secure __Host- cookie even when TLS ended before a plain-HTTP hop', async () => {
    process.env.DOT_AI_UI_SECURE_COOKIES = 'true'
    const res = await jsonPost('/api/v1/auth/login', { token: STATIC }, { 'X-Forwarded-Proto': 'http' })
    const [cookie] = res.headers.getSetCookie()
    expect(cookie).toMatch(new RegExp(`^${SECURE_SESSION_COOKIE}=`))
    expect(cookie).toContain('; Secure')
  })

  it('true: only the __Host- cookie is read, so a tossed plain cookie is ignored', async () => {
    process.env.DOT_AI_UI_SECURE_COOKIES = 'true'
    expect((await req('/api/v1/whoami', { headers: { Cookie: `${SESSION_COOKIE}=${STATIC}` } })).status).toBe(401)
    expect((await req('/api/v1/whoami', { headers: { Cookie: `${SECURE_SESSION_COOKIE}=${STATIC}` } })).status).toBe(200)
  })

  it('false: never Secure, even on HTTPS', async () => {
    process.env.DOT_AI_UI_SECURE_COOKIES = 'false'
    const res = await jsonPost('/api/v1/auth/login', { token: STATIC }, { 'X-Forwarded-Proto': 'https' })
    const [cookie] = res.headers.getSetCookie()
    expect(cookie).toMatch(new RegExp(`^${SESSION_COOKIE}=`))
    expect(cookie).not.toContain('Secure')
  })

  it('auto: a browser Origin of https://<this host> marks the request as HTTPS', async () => {
    const host = new URL(base).host
    const res = await jsonPost('/api/v1/auth/login', { token: STATIC }, { Origin: `https://${host}` })
    expect(res.status).toBe(200)
    const [cookie] = res.headers.getSetCookie()
    expect(cookie).toMatch(new RegExp(`^${SECURE_SESSION_COOKIE}=`))
    expect(cookie).toContain('; Secure')
  })
})

describe('GET /auth/logout', () => {
  it('clears the cookie and redirects home', async () => {
    const res = await req('/auth/logout')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/')
    const cookies = res.headers.getSetCookie()
    // Both names are always expired, whichever one the browser holds
    expect(cookies.some((c) => new RegExp(`^${SESSION_COOKIE}=; .*Max-Age=0`).test(c))).toBe(true)
    expect(cookies.some((c) => new RegExp(`^${SECURE_SESSION_COOKIE}=; .*Max-Age=0.*Secure`).test(c))).toBe(true)
  })
})
