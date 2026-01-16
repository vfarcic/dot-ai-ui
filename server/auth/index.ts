import type { Request, Response, NextFunction } from 'express'
import type { AuthConfig } from './types.js'
import { bearerStrategy } from './strategies/bearer.js'

/**
 * Authentication Module
 *
 * This module provides request authentication for the dashboard.
 * It uses a strategy pattern to allow easy swapping of auth mechanisms.
 *
 * Current strategy: Bearer token
 * Future strategies: OAuth/OIDC, API keys, etc.
 *
 * Auth is always enabled. If DOT_AI_UI_AUTH_TOKEN is not set, a random
 * token is auto-generated and printed to the console at startup.
 * To replace this module, update the imports in server/index.ts.
 */

// Default configuration - can be overridden for testing
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
 * Usage in server/index.ts:
 *   import { authMiddleware } from './auth/index.js'
 *   app.use('/api', authMiddleware)
 *
 * Or for specific routes:
 *   app.get('/api/v1/resources', authMiddleware, handler)
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip auth if disabled
  if (!isAuthEnabled()) {
    next()
    return
  }

  try {
    const result = await config.strategy.authenticate(req)

    if (!result.authenticated) {
      res.status(401).json({
        error: result.error || 'Unauthorized',
        authRequired: true,
        strategy: config.strategy.name,
      })
      return
    }

    // Attach user info to request for downstream handlers (future use)
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
 * Returns 200 if token is valid, 401 if not.
 * Used by frontend to validate token before storing.
 */
export async function verifyHandler(
  req: Request,
  res: Response
): Promise<void> {
  if (!isAuthEnabled()) {
    res.json({ authenticated: true, authEnabled: false })
    return
  }

  const result = await config.strategy.authenticate(req)

  if (result.authenticated) {
    res.json({ authenticated: true, authEnabled: true })
  } else {
    res.status(401).json({
      authenticated: false,
      authEnabled: true,
      error: result.error,
    })
  }
}

/**
 * Endpoint handler for auth status (no token required)
 *
 * Returns whether auth is enabled and what strategy is in use.
 * Used by frontend to decide whether to show login page.
 */
export function statusHandler(_req: Request, res: Response): void {
  res.json({
    authEnabled: isAuthEnabled(),
    strategy: isAuthEnabled() ? config.strategy.name : null,
  })
}
