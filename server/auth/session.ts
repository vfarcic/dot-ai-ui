import crypto from 'crypto'
import type { Request, Response } from 'express'

/**
 * Session cookie helpers.
 *
 * The UI credential (an OAuth JWT or the static UI token) lives only in an
 * HttpOnly cookie, so no page script can read it. The browser attaches it to
 * same-origin requests automatically; the frontend never handles the token.
 *
 * Cookie attributes: HttpOnly; SameSite=Strict; Path=/; Secure on HTTPS.
 * On HTTPS the `__Host-` prefix is used, which the browser only accepts with
 * Secure, Path=/ and no Domain attribute. That stops a sibling subdomain from
 * planting ("tossing") its own session cookie onto this host. Plain-HTTP
 * requests (local dev, E2E on http://localhost) cannot use the prefix, so they
 * fall back to the unprefixed name.
 *
 * Whether a request counts as HTTPS is set by DOT_AI_UI_SECURE_COOKIES:
 *   true  - always HTTPS (Secure + `__Host-`, only the prefixed cookie is read).
 *           Use this whenever users reach the UI over HTTPS: TLS often ends at
 *           a proxy that forwards plain HTTP and a wrong X-Forwarded-Proto.
 *           The Helm chart sets it when ingress TLS or an HTTPS gateway
 *           listener is configured.
 *   false - never (plain-HTTP installs only).
 *   auto  - (default) `req.secure`, which honours X-Forwarded-Proto behind a
 *           trusted proxy, or an `Origin: https://<this host>` header from the
 *           browser (which reports the scheme the page was loaded over).
 */

export const SESSION_COOKIE = 'dot-ai-ui-session'
export const SECURE_SESSION_COOKIE = `__Host-${SESSION_COOKIE}`

/** Browser retention for a static-token session: one working day. */
export const STATIC_TOKEN_SESSION_SECONDS = 8 * 60 * 60

/** Upper bound for any session cookie, whatever the issuer says. */
export const MAX_SESSION_SECONDS = 7 * 24 * 60 * 60

/** Cookies are capped at ~4 KB by browsers; reject anything that cannot fit. */
export const MAX_CREDENTIAL_LENGTH = 3800

export type SessionMode = 'oauth' | 'token'

/**
 * Parse a Cookie header into a name -> value map. Values are URI-decoded;
 * a value that fails to decode is kept raw rather than throwing.
 */
export function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {}
  if (!header) return cookies

  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq <= 0) continue
    const name = part.slice(0, eq).trim()
    let value = part.slice(eq + 1).trim()
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value.slice(1, -1)
    }
    if (!name || name in cookies) continue // first occurrence wins, like browsers send most-specific first
    try {
      cookies[name] = decodeURIComponent(value)
    } catch {
      cookies[name] = value
    }
  }
  return cookies
}

export interface CookieOptions {
  maxAgeSeconds: number
  secure: boolean
}

/**
 * Serialize the session cookie. Name depends on whether the request is HTTPS.
 */
export function serializeSessionCookie(value: string, { maxAgeSeconds, secure }: CookieOptions): string {
  const name = secure ? SECURE_SESSION_COOKIE : SESSION_COOKIE
  const maxAge = Math.max(0, Math.floor(maxAgeSeconds))
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
  ]
  if (maxAge === 0) {
    parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT')
  }
  if (secure) {
    parts.push('Secure')
  }
  return parts.join('; ')
}

export type SecureCookieMode = 'always' | 'never' | 'auto'

let warnedAboutSecureSetting = false

/**
 * Parse DOT_AI_UI_SECURE_COOKIES. Unknown values fall back to `auto` with a
 * one-time warning rather than refusing to start.
 */
export function getSecureCookieMode(value = process.env.DOT_AI_UI_SECURE_COOKIES): SecureCookieMode {
  const v = (value ?? '').trim().toLowerCase()
  if (v === '' || v === 'auto') return 'auto'
  if (['true', '1', 'yes', 'on', 'always'].includes(v)) return 'always'
  if (['false', '0', 'no', 'off', 'never'].includes(v)) return 'never'
  if (!warnedAboutSecureSetting) {
    warnedAboutSecureSetting = true
    console.warn(`[Auth] Ignoring invalid DOT_AI_UI_SECURE_COOKIES=${JSON.stringify(value)}; using auto`)
  }
  return 'auto'
}

/** True when the browser says the page came from https://<this host>. */
function hasSameHostHttpsOrigin(req: Request): boolean {
  const origin = req.headers.origin
  if (typeof origin !== 'string' || !origin.startsWith('https://')) return false
  try {
    const originHost = new URL(origin).host.toLowerCase()
    // Same host rule as the CSRF check: req.host (X-Forwarded-Host behind a
    // trusted proxy) or the raw Host header.
    const hosts = [req.host, req.headers.host].filter(Boolean).map((h) => String(h).toLowerCase())
    return hosts.includes(originHost)
  } catch {
    return false
  }
}

/**
 * Whether session cookies for this request are issued as HTTPS cookies
 * (Secure + `__Host-`). See DOT_AI_UI_SECURE_COOKIES above.
 */
export function isSecureRequest(req: Request): boolean {
  switch (getSecureCookieMode()) {
    case 'always':
      return true
    case 'never':
      return false
    default:
      return Boolean(req.secure) || hasSameHostHttpsOrigin(req)
  }
}

/**
 * Whether only `__Host-` cookies are accepted from this request. Unlike
 * isSecureRequest this ignores the Origin hint: Origin is only sent on some
 * requests, and a cookie issued on a request without it (e.g. the OAuth
 * callback) must still be read on one that has it.
 */
function acceptsOnlyPrefixedCookies(req: Request): boolean {
  switch (getSecureCookieMode()) {
    case 'always':
      return true
    case 'never':
      return false
    default:
      return Boolean(req.secure)
  }
}

function appendSetCookie(res: Response, cookie: string): void {
  res.append('Set-Cookie', cookie)
}

/**
 * Set the session cookie on the response.
 */
export function setSessionCookie(req: Request, res: Response, credential: string, maxAgeSeconds: number): void {
  const secure = isSecureRequest(req)
  appendSetCookie(res, serializeSessionCookie(credential, { maxAgeSeconds, secure }))
  res.setHeader('Cache-Control', 'no-store')
}

/**
 * Clear the session cookie. Both the prefixed and the plain name are always
 * expired: which one the browser holds can differ from how this request was
 * classified (a deployment that switched between HTTP and HTTPS, or a cookie
 * set on a POST whose Origin revealed HTTPS). A browser on plain HTTP simply
 * ignores the Secure clearing header.
 */
export function clearSessionCookie(_req: Request, res: Response): void {
  appendSetCookie(res, serializeSessionCookie('', { maxAgeSeconds: 0, secure: true }))
  appendSetCookie(res, serializeSessionCookie('', { maxAgeSeconds: 0, secure: false }))
  res.setHeader('Cache-Control', 'no-store')
}

/**
 * Read the session credential from the request's cookies.
 *
 * On HTTPS only the `__Host-` cookie is trusted: an unprefixed cookie there
 * could have been planted by a sibling subdomain.
 */
export function getSessionCookie(req: Request): string | null {
  const cookies = parseCookies(req.headers.cookie)
  const value = acceptsOnlyPrefixedCookies(req)
    ? cookies[SECURE_SESSION_COOKIE]
    : cookies[SECURE_SESSION_COOKIE] ?? cookies[SESSION_COOKIE]
  return value ? value : null
}

/**
 * Single source of truth for "which credential did this request present".
 *
 * Order:
 *   1. `Authorization: Bearer <token>` — kept for non-browser API clients
 *      (scripts, curl, CI). Browsers never attach this header on their own,
 *      so accepting it adds no CSRF exposure, and the browser app never sends it.
 *   2. The HttpOnly session cookie — what the browser app uses.
 *
 * Authorization decisions (JWT passthrough vs static token) live elsewhere;
 * this function only answers where the credential comes from.
 */
export function getRequestCredential(req: Request): string | null {
  return getBearerCredential(req) ?? getSessionCookie(req)
}

function getBearerCredential(req: Request): string | null {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    if (token) return token
  }
  return null
}

/**
 * True when the credential getRequestCredential() picks for this request is
 * the session cookie (no Bearer header took precedence).
 */
export function credentialIsFromCookie(req: Request): boolean {
  return getBearerCredential(req) === null && getSessionCookie(req) !== null
}

/**
 * A JWT is three dot-separated segments. Matches the proxy's existing
 * "contains a dot means OAuth JWT" rule.
 */
export function isJwtShaped(token: string): boolean {
  return token.includes('.')
}

export interface JwtClaims {
  sub?: string
  email?: string
  exp?: number
  iat?: number
}

/**
 * Decode a JWT payload WITHOUT verifying the signature. The dot-ai server is
 * the only authority on JWT validity and verifies it on every proxied request.
 * The claims here are used for display (email) and cookie lifetime only.
 */
export function decodeJwtClaims(token: string): JwtClaims | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const json = Buffer.from(parts[1], 'base64url').toString('utf8')
    const payload = JSON.parse(json)
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
    const claims: JwtClaims = {}
    if (typeof payload.sub === 'string') claims.sub = payload.sub
    if (typeof payload.email === 'string') claims.email = payload.email
    if (typeof payload.exp === 'number' && Number.isFinite(payload.exp)) claims.exp = payload.exp
    if (typeof payload.iat === 'number' && Number.isFinite(payload.iat)) claims.iat = payload.iat
    return claims
  } catch {
    return null
  }
}

/**
 * Cookie lifetime for an OAuth access token.
 *
 * The issuer's `expires_in` (from the direct server-to-server token exchange)
 * is the primary source. If the token's own `exp` claim is in the future and
 * earlier, the cookie is shortened to match it, so the cookie never outlives
 * the token. An `exp` already in the past is not acted on here (clock skew
 * between this server and the issuer); the dot-ai server rejects a genuinely
 * expired token on the first proxied request anyway.
 */
export function oauthCookieMaxAge(token: string, expiresIn: number | undefined, nowMs = Date.now()): number {
  let maxAge = typeof expiresIn === 'number' && Number.isFinite(expiresIn) && expiresIn > 0
    ? expiresIn
    : 3600

  const exp = decodeJwtClaims(token)?.exp
  if (exp !== undefined) {
    const untilExp = exp - Math.floor(nowMs / 1000)
    if (untilExp > 0 && untilExp < maxAge) {
      maxAge = untilExp
    }
  }

  return Math.min(Math.floor(maxAge), MAX_SESSION_SECONDS)
}

/**
 * OAuth login binding cookie.
 *
 * GET /auth/login binds the OAuth `state` to the browser with this cookie, and
 * GET /auth/callback only redeems a code whose `state` matches it. Without it
 * any browser presenting a valid code+state pair (e.g. one an attacker
 * obtained by starting a login themselves) would be signed in as that
 * attacker (login CSRF / session fixation).
 *
 * The cookie holds HMAC-SHA256(state), never the state itself, keyed with a
 * random secret generated when this process starts. The pending authorization
 * the state refers to lives in this process's memory too (oauth-client.ts),
 * so a restart invalidates both together.
 *
 * SameSite=Lax, not Strict: the return from the identity provider is a
 * cross-site top-level navigation, and Lax cookies are sent on those.
 * On HTTPS it uses the `__Host-` prefix so a sibling subdomain cannot plant it.
 */
export const OAUTH_STATE_HASH_COOKIE = 'dot-ai-ui-oauth-state'
export const SECURE_OAUTH_STATE_HASH_COOKIE = `__Host-${OAUTH_STATE_HASH_COOKIE}`

/** Matches the server-side pending-authorization TTL. */
export const STATE_COOKIE_SECONDS = 10 * 60

const STATE_HASH_KEY = crypto.randomBytes(32)

/** HMAC-SHA256 of an OAuth `state`, base64url: the value the binding cookie holds. */
export function hashOAuthState(state: string): string {
  return crypto.createHmac('sha256', STATE_HASH_KEY).update(state).digest('base64url')
}

function serializeStateHashCookie(stateHash: string, maxAgeSeconds: number, secure: boolean): string {
  const parts = [
    `${secure ? SECURE_OAUTH_STATE_HASH_COOKIE : OAUTH_STATE_HASH_COOKIE}=${encodeURIComponent(stateHash)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ]
  if (maxAgeSeconds === 0) parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT')
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function setOAuthStateCookie(req: Request, res: Response, state: string): void {
  appendSetCookie(res, serializeStateHashCookie(hashOAuthState(state), STATE_COOKIE_SECONDS, isSecureRequest(req)))
  res.setHeader('Cache-Control', 'no-store')
}

export function clearOAuthStateCookie(res: Response): void {
  appendSetCookie(res, serializeStateHashCookie('', 0, true))
  appendSetCookie(res, serializeStateHashCookie('', 0, false))
}

/**
 * Whether the callback's `state` matches the one this browser was given at
 * /auth/login: HMAC(state) is compared to the cookie in constant time. On
 * HTTPS only the `__Host-` cookie counts.
 */
export function oauthStateMatches(req: Request, state: string): boolean {
  const cookies = parseCookies(req.headers.cookie)
  const expectedHash = acceptsOnlyPrefixedCookies(req)
    ? cookies[SECURE_OAUTH_STATE_HASH_COOKIE]
    : cookies[SECURE_OAUTH_STATE_HASH_COOKIE] ?? cookies[OAUTH_STATE_HASH_COOKIE]
  if (!expectedHash || !state) return false
  const expected = Buffer.from(expectedHash)
  const actual = Buffer.from(hashOAuthState(state))
  // Both are fixed-length HMAC encodings unless the cookie was tampered with;
  // the length check only rejects malformed cookies.
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}
