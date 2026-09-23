import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchWithAuth, AUTH_REQUIRED_EVENT } from './authHeaders'

afterEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

describe('fetchWithAuth', () => {
  it('relies on the same-origin session cookie and never adds an Authorization header', async () => {
    // Even if an old release left a token behind, it must not be sent.
    sessionStorage.setItem('dot-ai-ui-auth-token', 'legacy-token')
    const fetchMock = vi.fn(async () => new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)

    await fetchWithAuth('/api/v1/resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/v1/resources')
    expect(init.credentials).toBe('same-origin')
    expect(init.method).toBe('POST')
    const headers = new Headers(init.headers)
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.has('Authorization')).toBe(false)
  })

  it('announces a 401 so the auth layer can re-check the session', async () => {
    const listener = vi.fn()
    window.addEventListener(AUTH_REQUIRED_EVENT, listener)
    try {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
      const res = await fetchWithAuth('/api/v1/resources')
      expect(res.status).toBe(401)
      expect(listener).toHaveBeenCalledTimes(1)

      vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })))
      await fetchWithAuth('/api/v1/resources')
      expect(listener).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener(AUTH_REQUIRED_EVENT, listener)
    }
  })
})
