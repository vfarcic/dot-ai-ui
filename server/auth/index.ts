import type { Request, Response, NextFunction } from 'express'
import type { AuthConfig } from './types.js'
import { bearerStrategy } from './strategies/bearer.js'
import { oauthStrategy } from './strategies/oauth.js'
import { isOAuthReady } from './oauth-client.js'

/**
 * Authentication Module
 *
 * Uses a multi-strategy approach:
 * 1. If the token looks like a JWT (contains dots), try OAuth strategy first
 * 2. Fall back to bearer token strategy
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
 * Tries OAuth JWT strategy first (if token looks like JWT),
 * then falls back to bearer token strategy.
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

    // Try OAuth strategy first if token looks like a JWT
    if (token && token.includes('.') && isOAuthReady()) {
      const oauthResult = await oauthStrategy.authenticate(req)
      if (oauthResult.authenticated) {
        if (oauthResult.userId) {
          ;(req as Request & { userId?: string; userEmail?: string }).userId =
            oauthResult.userId
        }
        if (oauthResult.userEmail) {
          ;(req as Request & { userId?: string; userEmail?: string }).userEmail =
            oauthResult.userEmail
        }
        next()
        return
      }
      // JWT was invalid — don't fall through to bearer, return the OAuth error
      res.status(401).json({
        error: oauthResult.error || 'Unauthorized',
        authRequired: true,
        strategy: 'oauth',
      })
      return
    }

    // Fall back to bearer token strategy
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

    // Try OAuth if JWT
    if (token && token.includes('.') && isOAuthReady()) {
      const oauthResult = await oauthStrategy.authenticate(req)
      if (oauthResult.authenticated) {
        res.json({
          authenticated: true,
          authEnabled: true,
          authMode: 'oauth',
          userEmail: oauthResult.userEmail,
        })
        return
      }
    }

    // Try bearer
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
