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

/**
 * Whether the request arrived over HTTPS. `req.secure` honours
 * X-Forwarded-Proto when `trust proxy` is set (production).
 */
function isSecureRequest(req: Request): boolean {
  return Boolean(req.secure)
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
 * Clear the session cookie (both the prefixed and the plain name, so a
 * deployment that switched between HTTP and HTTPS leaves nothing behind).
 */
export function clearSessionCookie(req: Request, res: Response): void {
  const secure = isSecureRequest(req)
  if (secure) {
    appendSetCookie(res, serializeSessionCookie('', { maxAgeSeconds: 0, secure: true }))
  }
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
  const value = isSecureRequest(req)
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
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    if (token) return token
  }
  return getSessionCookie(req)
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
