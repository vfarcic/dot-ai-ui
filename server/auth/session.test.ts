// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { Request } from 'express'
import {
  parseCookies,
  serializeSessionCookie,
  getRequestCredential,
  getSessionCookie,
  decodeJwtClaims,
  oauthCookieMaxAge,
  isJwtShaped,
  SESSION_COOKIE,
  SECURE_SESSION_COOKIE,
  MAX_SESSION_SECONDS,
  getSecureCookieMode,
  isSecureRequest,
} from './session.js'

function jwt(payload: Record<string, unknown>): string {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(payload)}.sig`
}

function fakeReq(headers: Record<string, string>, secure = false): Request {
  return { headers, secure } as unknown as Request
}

describe('parseCookies', () => {
  it('returns an empty map for a missing header', () => {
    expect(parseCookies(undefined)).toEqual({})
    expect(parseCookies('')).toEqual({})
  })

  it('parses multiple cookies, trims whitespace and URI-decodes values', () => {
    expect(parseCookies('a=1; b = two%20words ;c=%3Bx')).toEqual({ a: '1', b: 'two words', c: ';x' })
  })

  it('strips surrounding quotes and keeps the first duplicate', () => {
    expect(parseCookies('a="quoted"; a=second')).toEqual({ a: 'quoted' })
  })

  it('keeps a value raw when it is not valid URI encoding and skips nameless parts', () => {
    expect(parseCookies('bad=%E0%A4%A; =orphan; novalue')).toEqual({ bad: '%E0%A4%A' })
  })
})

describe('serializeSessionCookie', () => {
  it('sets HttpOnly, SameSite=Strict, Path=/ and Max-Age on plain HTTP without Secure', () => {
    const cookie = serializeSessionCookie('tok;en', { maxAgeSeconds: 60, secure: false })
    expect(cookie).toBe(`${SESSION_COOKIE}=tok%3Ben; Path=/; HttpOnly; SameSite=Strict; Max-Age=60`)
  })

  it('uses the __Host- prefix and Secure on HTTPS', () => {
    const cookie = serializeSessionCookie('t', { maxAgeSeconds: 10.9, secure: true })
    expect(cookie.startsWith(`${SECURE_SESSION_COOKIE}=t;`)).toBe(true)
    expect(cookie).toContain('; Secure')
    expect(cookie).toContain('Max-Age=10')
    expect(cookie).not.toContain('Domain=')
  })

  it('expires the cookie immediately for a zero or negative lifetime', () => {
    const cookie = serializeSessionCookie('', { maxAgeSeconds: -5, secure: false })
    expect(cookie).toContain('Max-Age=0')
    expect(cookie).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT')
  })
})

describe('getRequestCredential', () => {
  it('prefers the Authorization header (API clients) over the cookie', () => {
    const req = fakeReq({ authorization: 'Bearer header-token', cookie: `${SESSION_COOKIE}=cookie-token` })
    expect(getRequestCredential(req)).toBe('header-token')
  })

  it('falls back to the session cookie', () => {
    expect(getRequestCredential(fakeReq({ cookie: `other=1; ${SESSION_COOKIE}=cookie-token` }))).toBe('cookie-token')
  })

  it('ignores a non-Bearer or empty Authorization header', () => {
    expect(getRequestCredential(fakeReq({ authorization: 'Basic abc' }))).toBeNull()
    expect(getRequestCredential(fakeReq({ authorization: 'Bearer   ', cookie: `${SESSION_COOKIE}=c` }))).toBe('c')
  })

  it('returns null when no credential is present', () => {
    expect(getRequestCredential(fakeReq({}))).toBeNull()
    expect(getRequestCredential(fakeReq({ cookie: `${SESSION_COOKIE}=` }))).toBeNull()
  })
})

describe('getSessionCookie', () => {
  it('on HTTPS trusts only the __Host- cookie (an unprefixed one could be planted by a subdomain)', () => {
    expect(getSessionCookie(fakeReq({ cookie: `${SESSION_COOKIE}=tossed` }, true))).toBeNull()
    expect(getSessionCookie(fakeReq({ cookie: `${SESSION_COOKIE}=tossed; ${SECURE_SESSION_COOKIE}=real` }, true))).toBe('real')
  })

  it('on HTTP accepts either name, preferring the prefixed one', () => {
    expect(getSessionCookie(fakeReq({ cookie: `${SESSION_COOKIE}=plain` }))).toBe('plain')
    expect(getSessionCookie(fakeReq({ cookie: `${SESSION_COOKIE}=plain; ${SECURE_SESSION_COOKIE}=pref` }))).toBe('pref')
  })
})

describe('JWT helpers', () => {
  it('detects JWT-shaped tokens by the dot, like the proxy does', () => {
    expect(isJwtShaped('a.b.c')).toBe(true)
    expect(isJwtShaped('static-token')).toBe(false)
  })

  it('decodes known claims and drops wrongly typed ones', () => {
    expect(decodeJwtClaims(jwt({ sub: 's', email: 'e@x', exp: 10, iat: 5, extra: 1 }))).toEqual({
      sub: 's',
      email: 'e@x',
      exp: 10,
      iat: 5,
    })
    expect(decodeJwtClaims(jwt({ email: 42, exp: 'soon' }))).toEqual({})
  })

  it('returns null for malformed tokens', () => {
    expect(decodeJwtClaims('only.two')).toBeNull()
    expect(decodeJwtClaims('a.!!!notjson.c')).toBeNull()
    expect(decodeJwtClaims(`a.${Buffer.from('[1]').toString('base64url')}.c`)).toBeNull()
  })
})

describe('oauthCookieMaxAge', () => {
  const now = 1_000_000_000_000
  const nowSec = now / 1000

  it('uses the issuer expires_in', () => {
    expect(oauthCookieMaxAge(jwt({}), 900, now)).toBe(900)
  })

  it('shortens to the exp claim when that comes first', () => {
    expect(oauthCookieMaxAge(jwt({ exp: nowSec + 120 }), 900, now)).toBe(120)
    expect(oauthCookieMaxAge(jwt({ exp: nowSec + 5000 }), 900, now)).toBe(900)
  })

  it('does not act on an exp claim already in the past (issuer clock skew)', () => {
    expect(oauthCookieMaxAge(jwt({ exp: nowSec - 10 }), 900, now)).toBe(900)
  })

  it('defaults to one hour without expires_in and caps very long lifetimes', () => {
    expect(oauthCookieMaxAge(jwt({}), undefined, now)).toBe(3600)
    expect(oauthCookieMaxAge(jwt({}), 0, now)).toBe(3600)
    expect(oauthCookieMaxAge(jwt({}), 10 * MAX_SESSION_SECONDS, now)).toBe(MAX_SESSION_SECONDS)
  })
})

describe('secure cookie mode', () => {
  afterEach(() => {
    delete process.env.DOT_AI_UI_SECURE_COOKIES
  })

  it('parses DOT_AI_UI_SECURE_COOKIES, defaulting to auto', () => {
    expect(getSecureCookieMode(undefined)).toBe('auto')
    expect(getSecureCookieMode('')).toBe('auto')
    expect(getSecureCookieMode('AUTO')).toBe('auto')
    expect(getSecureCookieMode('true')).toBe('always')
    expect(getSecureCookieMode(' 1 ')).toBe('always')
    expect(getSecureCookieMode('false')).toBe('never')
    expect(getSecureCookieMode('no')).toBe('never')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(getSecureCookieMode('ture')).toBe('auto')
    warn.mockRestore()
  })

  it('auto: follows req.secure, or an https Origin for this host only', () => {
    expect(isSecureRequest(fakeReq({}, true))).toBe(true)
    expect(isSecureRequest(fakeReq({}))).toBe(false)
    expect(isSecureRequest(fakeReq({ host: 'ui.example.com', origin: 'https://ui.example.com' }))).toBe(true)
    expect(isSecureRequest(fakeReq({ host: 'ui.example.com', origin: 'https://evil.example' }))).toBe(false)
    expect(isSecureRequest(fakeReq({ host: 'ui.example.com', origin: 'http://ui.example.com' }))).toBe(false)
    expect(isSecureRequest(fakeReq({ host: 'ui.example.com', origin: 'https://%' }))).toBe(false)
  })

  it('auto: the Origin hint never stops a plain cookie from being read', () => {
    // e.g. an OAuth cookie issued on a GET (no Origin) behind a proxy that reports http
    const req = fakeReq({ host: 'ui.example.com', origin: 'https://ui.example.com', cookie: `${SESSION_COOKIE}=jwt` })
    expect(getSessionCookie(req)).toBe('jwt')
  })

  it('always / never override req.secure', () => {
    process.env.DOT_AI_UI_SECURE_COOKIES = 'true'
    expect(isSecureRequest(fakeReq({}))).toBe(true)
    expect(getSessionCookie(fakeReq({ cookie: `${SESSION_COOKIE}=tossed` }))).toBeNull()
    process.env.DOT_AI_UI_SECURE_COOKIES = 'false'
    expect(isSecureRequest(fakeReq({}, true))).toBe(false)
  })
})
