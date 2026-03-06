import type { Request } from 'express'
import type { AuthStrategy, AuthResult } from '../types.js'
import { decodeJwtPayload } from '../oauth-client.js'

/**
 * OAuth JWT authentication strategy
 *
 * Validates JWT access tokens issued by the dot-ai server.
 * Extracts user identity (email, subject) from the JWT payload.
 *
 * The JWT is trusted because:
 * - It was obtained via the server-to-server token exchange
 * - The dot-ai server signs it with HMAC-SHA256
 * - We only accept tokens via the Authorization header
 */
export const oauthStrategy: AuthStrategy = {
  name: 'oauth',

  authenticate: async (req: Request): Promise<AuthResult> => {
    const authHeader = req.headers.authorization

    if (!authHeader) {
      return { authenticated: false, error: 'Authorization header required' }
    }

    if (!authHeader.startsWith('Bearer ')) {
      return {
        authenticated: false,
        error: 'Invalid authorization format. Expected: Bearer <token>',
      }
    }

    const token = authHeader.slice(7)

    // JWT tokens have 3 dot-separated parts; bearer tokens don't
    if (!token.includes('.')) {
      return { authenticated: false, error: 'Not a JWT token' }
    }

    try {
      const payload = decodeJwtPayload(token)

      // Check expiry
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        return { authenticated: false, error: 'Token expired' }
      }

      return {
        authenticated: true,
        userId: payload.sub,
        userEmail: payload.email,
      }
    } catch {
      return { authenticated: false, error: 'Invalid JWT token' }
    }
  },
}
