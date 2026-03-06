import type { Request, Response, NextFunction } from 'express'
import type { AuthConfig } from './types.js'
import { bearerStrategy } from './strategies/bearer.js'
import { isOAuthReady } from './oauth-client.js'

/**
 * Authentication Module
 *
 * Two auth paths:
 * 1. JWT tokens (OAuth) — passed through to dot-ai server for validation
 * 2. Bearer tokens (static) — validated locally against DOT_AI_UI_AUTH_TOKEN
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
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    // JWT tokens (OAuth) — pass through, let dot-ai server validate
    if (token && token.includes('.')) {
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
 * JWT tokens: trusted (came from server-side code exchange), returns authenticated.
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
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    // JWT tokens — trusted, pass through
    if (token && token.includes('.')) {
      res.json({
        authenticated: true,
        authEnabled: true,
        authMode: 'oauth',
      })
      return
    }

    // Bearer tokens — validate locally
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
    oauthEnabled: isOAuthReady(),
  })
}
