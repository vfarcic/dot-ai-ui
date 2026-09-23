import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { AuthProvider, useAuth, SESSION_ENDED_MESSAGE } from './AuthContext'
import { AUTH_REQUIRED_EVENT } from '@/api/authHeaders'

type Route = { status?: number; body: unknown }

/**
 * Minimal fetch stub keyed by "METHOD path". Records every call so tests can
 * assert what the app sent.
 */
function stubFetch(routes: Record<string, Route | (() => Route)>) {
  const calls: Array<{ key: string; init?: RequestInit }> = []
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase()
    const key = `${method} ${String(input)}`
    calls.push({ key, init })
    const entry = routes[key]
    if (!entry) throw new Error(`unexpected fetch ${key}`)
    const { status = 200, body } = typeof entry === 'function' ? entry() : entry
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  })
  vi.stubGlobal('fetch', fn)
  return { fn, calls }
}

const STATUS = { body: { authEnabled: true, strategy: 'bearer', oauthEnabled: true } }
const SIGNED_OUT = { body: { authenticated: false, authEnabled: true } }

let latest: ReturnType<typeof useAuth>

function Probe() {
  latest = useAuth()
  const a = latest
  return (
    <div>
      <span data-testid="loading">{String(a.isLoading)}</span>
      <span data-testid="authed">{String(a.isAuthenticated)}</span>
      <span data-testid="mode">{a.authMode ?? 'none'}</span>
      <span data-testid="email">{a.userEmail ?? 'none'}</span>
      <span data-testid="error">{a.error ?? 'none'}</span>
    </div>
  )
}

function renderAuth() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  )
}

async function loaded() {
  await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
}

function storageHasToken(): boolean {
  const values = [
    ...Object.keys(sessionStorage).map((k) => sessionStorage.getItem(k) ?? ''),
    ...Object.keys(localStorage).map((k) => localStorage.getItem(k) ?? ''),
  ]
  return values.some((v) => v.includes('secret-static-token'))
}

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  window.history.replaceState({}, '', '/dashboard')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AuthProvider', () => {
  it('shows signed-out state when the session endpoint says so', async () => {
    stubFetch({ 'GET /api/v1/auth/status': STATUS, 'GET /api/v1/auth/session': SIGNED_OUT })
    renderAuth()
    await loaded()
    expect(screen.getByTestId('authed')).toHaveTextContent('false')
    expect(latest.oauthEnabled).toBe(true)
  })

  it('restores an OAuth session (e.g. after reload) from the server, not from storage', async () => {
    const { calls } = stubFetch({
      'GET /api/v1/auth/status': STATUS,
      'GET /api/v1/auth/session': {
        body: { authenticated: true, authEnabled: true, mode: 'oauth', email: 'dev@example.com', expiresAt: 1 },
      },
    })
    renderAuth()
    await loaded()
    expect(screen.getByTestId('authed')).toHaveTextContent('true')
    expect(screen.getByTestId('mode')).toHaveTextContent('oauth')
    expect(screen.getByTestId('email')).toHaveTextContent('dev@example.com')

    const sessionCall = calls.find((c) => c.key === 'GET /api/v1/auth/session')
    expect(sessionCall?.init?.credentials).toBe('same-origin')
    expect(new Headers(sessionCall?.init?.headers).has('Authorization')).toBe(false)
  })

  it('removes tokens left in sessionStorage by earlier releases', async () => {
    sessionStorage.setItem('dot-ai-ui-auth-token', 'secret-static-token')
    sessionStorage.setItem('dot-ai-ui-auth-mode', 'token')
    sessionStorage.setItem('dot-ai-ui-user-email', 'x@y')
    stubFetch({ 'GET /api/v1/auth/status': STATUS, 'GET /api/v1/auth/session': SIGNED_OUT })
    renderAuth()
    await loaded()
    expect(sessionStorage.length).toBe(0)
  })

  it('logs in with a token via POST /login and keeps the token out of storage', async () => {
    const { calls } = stubFetch({
      'GET /api/v1/auth/status': STATUS,
      'GET /api/v1/auth/session': SIGNED_OUT,
      'POST /api/v1/auth/login': { body: { authenticated: true, authEnabled: true, mode: 'token' } },
    })
    renderAuth()
    await loaded()

    let ok = false
    await act(async () => {
      ok = await latest.login('secret-static-token')
    })

    expect(ok).toBe(true)
    expect(screen.getByTestId('authed')).toHaveTextContent('true')
    expect(screen.getByTestId('mode')).toHaveTextContent('token')
    expect(screen.getByTestId('email')).toHaveTextContent('none')

    const loginCall = calls.find((c) => c.key === 'POST /api/v1/auth/login')
    expect(JSON.parse(String(loginCall?.init?.body))).toEqual({ token: 'secret-static-token' })
    expect(new Headers(loginCall?.init?.headers).has('Authorization')).toBe(false)
    expect(storageHasToken()).toBe(false)
  })

  it('reports an invalid token without authenticating', async () => {
    stubFetch({
      'GET /api/v1/auth/status': STATUS,
      'GET /api/v1/auth/session': SIGNED_OUT,
      'POST /api/v1/auth/login': { status: 401, body: { authenticated: false, error: 'Invalid token' } },
    })
    renderAuth()
    await loaded()

    let ok = true
    await act(async () => {
      ok = await latest.login('wrong')
    })
    expect(ok).toBe(false)
    expect(screen.getByTestId('authed')).toHaveTextContent('false')
    expect(screen.getByTestId('error')).toHaveTextContent('Invalid token')
  })

  it('reports rate limiting on login distinctly', async () => {
    stubFetch({
      'GET /api/v1/auth/status': STATUS,
      'GET /api/v1/auth/session': SIGNED_OUT,
      'POST /api/v1/auth/login': { status: 429, body: { error: 'Too many' } },
    })
    renderAuth()
    await loaded()
    await act(async () => {
      await latest.login('x')
    })
    expect(screen.getByTestId('error')).toHaveTextContent('Too many attempts')
  })

  it('rejects an empty token without calling the server', async () => {
    const { calls } = stubFetch({ 'GET /api/v1/auth/status': STATUS, 'GET /api/v1/auth/session': SIGNED_OUT })
    renderAuth()
    await loaded()
    await act(async () => {
      await latest.login('   ')
    })
    expect(screen.getByTestId('error')).toHaveTextContent('Token cannot be empty')
    expect(calls.some((c) => c.key.includes('/login'))).toBe(false)
  })

  it('logs out via POST /logout and drops the session state', async () => {
    const { calls } = stubFetch({
      'GET /api/v1/auth/status': STATUS,
      'GET /api/v1/auth/session': { body: { authenticated: true, authEnabled: true, mode: 'oauth', email: 'a@b' } },
      'POST /api/v1/auth/logout': { body: { authenticated: false } },
    })
    renderAuth()
    await loaded()
    expect(screen.getByTestId('authed')).toHaveTextContent('true')

    await act(async () => {
      await latest.logout()
    })
    expect(calls.some((c) => c.key === 'POST /api/v1/auth/logout')).toBe(true)
    expect(screen.getByTestId('authed')).toHaveTextContent('false')
    expect(screen.getByTestId('email')).toHaveTextContent('none')
  })

  it('surfaces an OAuth callback error from the URL and cleans the URL', async () => {
    window.history.replaceState({}, '', '/dashboard?auth_error=Access%20denied')
    stubFetch({ 'GET /api/v1/auth/status': STATUS, 'GET /api/v1/auth/session': SIGNED_OUT })
    renderAuth()
    await loaded()
    expect(screen.getByTestId('error')).toHaveTextContent('Access denied')
    expect(window.location.search).toBe('')
  })

  it('treats a server with auth disabled as authenticated without asking for a session', async () => {
    const { calls } = stubFetch({
      'GET /api/v1/auth/status': { body: { authEnabled: false, strategy: null, oauthEnabled: false } },
    })
    renderAuth()
    await loaded()
    expect(screen.getByTestId('authed')).toHaveTextContent('true')
    expect(calls.some((c) => c.key.includes('/session'))).toBe(false)
  })

  it('shows a connection error when the status check fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    stubFetch({ 'GET /api/v1/auth/status': { status: 500, body: {} } })
    renderAuth()
    await loaded()
    expect(screen.getByTestId('error')).toHaveTextContent('Failed to connect to server')
    expect(screen.getByTestId('authed')).toHaveTextContent('false')
    errSpy.mockRestore()
  })

  it('drops to signed-out when an API 401 shows the session cookie is gone (expiry or another tab signed out)', async () => {
    let signedIn = true
    const { calls } = stubFetch({
      'GET /api/v1/auth/status': STATUS,
      'GET /api/v1/auth/session': () =>
        signedIn ? { body: { authenticated: true, authEnabled: true, mode: 'token' } } : SIGNED_OUT,
    })
    renderAuth()
    await loaded()
    expect(screen.getByTestId('authed')).toHaveTextContent('true')

    signedIn = false
    await act(async () => {
      window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT))
    })
    await waitFor(() => expect(screen.getByTestId('authed')).toHaveTextContent('false'))
    expect(screen.getByTestId('error')).toHaveTextContent(SESSION_ENDED_MESSAGE)
    expect(calls.filter((c) => c.key === 'GET /api/v1/auth/session')).toHaveLength(2)
  })

  it('keeps the session when a 401 re-check finds it still valid', async () => {
    const { calls } = stubFetch({
      'GET /api/v1/auth/status': STATUS,
      'GET /api/v1/auth/session': { body: { authenticated: true, authEnabled: true, mode: 'oauth', email: 'a@b' } },
    })
    renderAuth()
    await loaded()

    await act(async () => {
      window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT))
    })
    await waitFor(() => expect(calls.filter((c) => c.key === 'GET /api/v1/auth/session')).toHaveLength(2))
    expect(screen.getByTestId('authed')).toHaveTextContent('true')
    expect(screen.getByTestId('email')).toHaveTextContent('a@b')
    expect(screen.getByTestId('error')).toHaveTextContent('none')
  })

  it('re-checks the session when the tab becomes visible again', async () => {
    let signedIn = true
    stubFetch({
      'GET /api/v1/auth/status': STATUS,
      'GET /api/v1/auth/session': () =>
        signedIn ? { body: { authenticated: true, authEnabled: true, mode: 'token' } } : SIGNED_OUT,
    })
    renderAuth()
    await loaded()

    signedIn = false
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(screen.getByTestId('authed')).toHaveTextContent('false'))
  })

  it('does not re-check when auth is disabled', async () => {
    const { calls } = stubFetch({
      'GET /api/v1/auth/status': { body: { authEnabled: false, strategy: null, oauthEnabled: false } },
    })
    renderAuth()
    await loaded()
    await act(async () => {
      window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT))
    })
    expect(calls.some((c) => c.key.includes('/session'))).toBe(false)
    expect(screen.getByTestId('authed')).toHaveTextContent('true')
  })
})
