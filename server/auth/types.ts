import type { Request } from 'express'

/**
 * Result of an authentication attempt
 */
export interface AuthResult {
  /** Whether the request is authenticated */
  authenticated: boolean
  /** Error message if authentication failed */
  error?: string
  /** Optional user identifier (for future multi-user support) */
  userId?: string
}

/**
 * Authentication strategy interface
 *
 * Implement this interface to add new authentication methods.
 * The strategy pattern allows swapping auth mechanisms without
 * changing the middleware or application code.
 *
 * Example strategies:
 * - Bearer token (current)
 * - Basic auth
 * - OAuth/OIDC
 * - API key
 */
export interface AuthStrategy {
  /** Unique name for this strategy (for logging/debugging) */
  name: string

  /**
   * Authenticate an incoming request
   * @param req - Express request object
   * @returns AuthResult indicating success/failure
   */
  authenticate: (req: Request) => Promise<AuthResult>

  /**
   * Optional: Check if this strategy is enabled/configured
   * If not implemented, strategy is assumed to be enabled
   */
  isEnabled?: () => boolean
}

/**
 * Configuration for the auth module
 */
export interface AuthConfig {
  /** Whether auth is enabled (if false, all requests pass through) */
  enabled: boolean
  /** The active strategy to use */
  strategy: AuthStrategy
}
