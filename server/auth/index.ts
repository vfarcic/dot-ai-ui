import { Router } from 'express'
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import type { AuthConfig } from './types.js'
import { bearerStrategy, isValidStaticToken } from './strategies/bearer.js'
import {
  getRequestCredential,
  getSessionCookie,
  setSessionCookie,
  clearSessionCookie,
  isJwtShaped,
  decodeJwtClaims,
  MAX_CREDENTIAL_LENGTH,
  STATIC_TOKEN_SESSION_SECONDS,
} from './session.js'
import type { SessionMode } from './session.js'

export { csrfProtection } from './csrf.js'
export { getRequestCredential } from './session.js'

/**
 * Authentication Module
 *
 * Two auth paths:
 * 1. JWT tokens (OAuth) — passed through to dot-ai server for validation
 * 2. Bearer tokens (static) — validated locally against DOT_AI_UI_AUTH_TOKEN
 *
 * The browser app presents either credential as an HttpOnly session cookie
 * (see session.ts). API clients may send `Authorization: Bearer` instead.
 *
 * Auth is always enabled. If DOT_AI_UI_AUTH_TOKEN is not set, a random
 * token is auto-generated and printed to the console at startup.
 */

const config: AuthConfig = {
  enabled: true,
  strategy: bearerStrategy,
}

/**
 * Check if authentication is currently enabled
 */
export function isAuthEnabled(): boolean {
  if (!config.enabled) return false
  if (config.strategy.isEnabled) {
    return config.strategy.isEnabled()
  }
  return true
}

/**
 * Get the name of the current auth strategy
 */
export function getAuthStrategyName(): string {
  return config.strategy.name
}

/**
 * Express middleware for authenticating API requests
 *
 * JWT tokens (OAuth): passed through without local validation.
 * The dot-ai server validates them when the proxy forwards the request.
 *
 * Non-JWT tokens: validated locally using bearer token strategy.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!isAuthEnabled()) {
    next()
    return
  }

  try {
    const token = getRequestCredential(req)

    // JWT tokens (OAuth) — pass through, let dot-ai server validate
    if (token && isJwtShaped(token)) {
      next()
      return
    }

    // Non-JWT tokens — validate locally with bearer strategy
    const result = await config.strategy.authenticate(req)

    if (!result.authenticated) {
      res.status(401).json({
        error: result.error || 'Unauthorized',
        authRequired: true,
        strategy: config.strategy.name,
      })
      return
    }

    if (result.userId) {
      ;(req as Request & { userId?: string }).userId = result.userId
    }

    next()
  } catch (error) {
    console.error('[Auth] Authentication error:', error)
    res.status(500).json({ error: 'Authentication service error' })
  }
}

/**
 * Endpoint handler for token verification
 *
 * The dot-ai backend is the single authority on JWT validity and re-verifies
 * the signature on every proxied data request. This endpoint therefore never
 * makes an auth decision about a JWT on its own: a JWT presented here falls
 * through to the static-bearer comparison and, unless it happens to equal the
 * configured DOT_AI_UI_AUTH_TOKEN, correctly receives 401. (The browser app
 * learns its OAuth session state from /api/v1/auth/session, not /verify.)
 *
 * Bearer tokens: validated locally.
 */
export async function verifyHandler(
  req: Request,
  res: Response
): Promise<void> {
  if (!isAuthEnabled()) {
    res.json({ authenticated: true, authEnabled: false })
    return
  }

  try {
    // Bearer tokens — validate locally. No JWT fast-path: decoding an
    // unverified JWT payload and returning authenticated:true would let a
    // forged token (e.g. alg:none) spoof the UI's auth state.
    const result = await config.strategy.authenticate(req)

    if (result.authenticated) {
      res.json({ authenticated: true, authEnabled: true, authMode: 'token' })
    } else {
      res.status(401).json({
        authenticated: false,
        authEnabled: true,
        error: result.error,
      })
    }
  } catch (error) {
    console.error('[Auth] Verification error:', error)
    res.status(500).json({
      authenticated: false,
      authEnabled: true,
      error: 'Authentication service error',
    })
  }
}

/**
 * Endpoint handler for auth status (no token required)
 *
 * Returns whether auth is enabled, what strategy is in use,
 * and whether OAuth login is available.
 */
export function statusHandler(_req: Request, res: Response): void {
  res.json({
    authEnabled: isAuthEnabled(),
    strategy: isAuthEnabled() ? config.strategy.name : null,
    oauthEnabled: true,
  })
}

/**
 * Session state as seen by the browser app. The credential itself is never
 * included — the app only learns whether it is signed in and as whom.
 */
export interface SessionInfo {
  authenticated: boolean
  authEnabled: boolean
  mode?: SessionMode
  email?: string
  /** Epoch milliseconds, from the token's exp claim (OAuth only) */
  expiresAt?: number
}

/**
 * Describe the session for a credential, without making any decision the
 * dot-ai server owns. A JWT is reported as an OAuth session: the dot-ai
 * server verifies it on every proxied request, and its claims are used here
 * for display only (the same trust the UI placed in them when it decoded the
 * token client-side). Anything else must match the static UI token.
 */
export function describeSession(credential: string | null): SessionInfo {
  if (!isAuthEnabled()) {
    return { authenticated: true, authEnabled: false }
  }
  if (!credential) {
    return { authenticated: false, authEnabled: true }
  }
  if (isValidStaticToken(credential)) {
    return { authenticated: true, authEnabled: true, mode: 'token' }
  }
  if (isJwtShaped(credential)) {
    const claims = decodeJwtClaims(credential)
    if (!claims) {
      return { authenticated: false, authEnabled: true }
    }
    const info: SessionInfo = { authenticated: true, authEnabled: true, mode: 'oauth' }
    if (claims.email) info.email = claims.email
    if (claims.exp !== undefined) info.expiresAt = claims.exp * 1000
    return info
  }
  return { authenticated: false, authEnabled: true }
}

/**
 * GET /api/v1/auth/session
 *
 * Tells the frontend whether it is signed in, in which mode, and (OAuth) as
 * whom. Always 200 so the app can render the login page without error noise.
 * A cookie that no longer describes a valid session is cleared.
 */
export function sessionHandler(req: Request, res: Response): void {
  const credential = getRequestCredential(req)
  const info = describeSession(credential)
  const cookie = getSessionCookie(req)
  if (!info.authenticated && cookie && cookie === credential) {
    clearSessionCookie(req, res)
  }
  res.setHeader('Cache-Control', 'no-store')
  res.json(info)
}

/**
 * POST /api/v1/auth/login  { "token": "<static UI token>" }
 *
 * Validates the static UI token and, on success, stores it in the HttpOnly
 * session cookie. The response body never echoes the token.
 */
export function loginHandler(req: Request, res: Response): void {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : ''

  if (!token) {
    res.status(400).json({ authenticated: false, error: 'Token cannot be empty' })
    return
  }

  if (token.length > MAX_CREDENTIAL_LENGTH || !isValidStaticToken(token)) {
    res.status(401).json({ authenticated: false, error: 'Invalid token' })
    return
  }

  setSessionCookie(req, res, token, STATIC_TOKEN_SESSION_SECONDS)
  res.json(describeSession(token))
}

/**
 * POST /api/v1/auth/logout — clears the session cookie.
 */
export function logoutHandler(req: Request, res: Response): void {
  clearSessionCookie(req, res)
  res.json({ authenticated: false, authEnabled: isAuthEnabled() })
}

/**
 * Router for /api/v1/auth/*. Mount at `/api/v1/auth` before the /api/v1 auth
 * gate; every route here handles its own authentication.
 */
export function createAuthApiRouter({
  authLimiter,
  apiLimiter,
}: {
  authLimiter: RequestHandler
  apiLimiter: RequestHandler
}): Router {
  const router = Router()

  // Public: is auth enabled, which strategy, is SSO available
  router.get('/status', authLimiter, statusHandler)

  // Static token check for API clients (Authorization header or cookie)
  router.get('/verify', authLimiter, authMiddleware, verifyHandler)

  // Session state for the browser app. Called on every page load, so it only
  // gets the general API limiter, not the strict auth one.
  router.get('/session', apiLimiter, sessionHandler)

  // Static-token sign-in: validates the token and sets the HttpOnly cookie
  router.post('/login', authLimiter, loginHandler)

  // Sign-out: clears the cookie
  router.post('/logout', apiLimiter, logoutHandler)

  return router
}
