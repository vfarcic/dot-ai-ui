import type { Request } from 'express'
import crypto from 'crypto'
import type { AuthStrategy, AuthResult } from '../types.js'

/**
 * Generate a cryptographically secure random token
 */
function generateRandomToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

// Token is either from env var or auto-generated at startup
// Auto-generated token is printed to logs for the user to copy
function initializeToken(): string {
  const envToken = process.env.DOT_AI_UI_AUTH_TOKEN

  if (envToken && envToken.length > 0) {
    return envToken
  }

  // Generate a random token and log it
  const generatedToken = generateRandomToken()
  console.log('')
  console.log('╔════════════════════════════════════════════════════════════════════╗')
  console.log('║  UI Authentication Token (auto-generated)                          ║')
  console.log('╠════════════════════════════════════════════════════════════════════╣')
  console.log(`║  ${generatedToken}  ║`)
  console.log('╠════════════════════════════════════════════════════════════════════╣')
  console.log('║  Set DOT_AI_UI_AUTH_TOKEN env var to use a fixed token             ║')
  console.log('╚════════════════════════════════════════════════════════════════════╝')
  console.log('')

  return generatedToken
}

// Initialize token on module load
const authToken = initializeToken()

/**
 * Get the current auth token (for display/debugging)
 */
export function getAuthToken(): string {
  return authToken
}

/**
 * Bearer token authentication strategy
 *
 * Validates requests using the Authorization header:
 *   Authorization: Bearer <token>
 *
 * Token is configured via DOT_AI_UI_AUTH_TOKEN environment variable.
 * If the env var is not set, a random token is generated and logged at startup.
 *
 * Security notes:
 * - Token comparison uses constant-time comparison to prevent timing attacks
 * - Token is never logged in requests
 * - Requires HTTPS in production to prevent token interception
 */
export const bearerStrategy: AuthStrategy = {
  name: 'bearer',

  isEnabled: () => {
    // Auth is always enabled now
    return true
  },

  authenticate: async (req: Request): Promise<AuthResult> => {
    const expectedToken = authToken

    const authHeader = req.headers.authorization

    if (!authHeader) {
      return {
        authenticated: false,
        error: 'Authorization header required',
      }
    }

    if (!authHeader.startsWith('Bearer ')) {
      return {
        authenticated: false,
        error: 'Invalid authorization format. Expected: Bearer <token>',
      }
    }

    const providedToken = authHeader.slice(7) // Remove 'Bearer ' prefix

    // Constant-time comparison to prevent timing attacks
    if (!constantTimeEqual(providedToken, expectedToken)) {
      return {
        authenticated: false,
        error: 'Invalid token',
      }
    }

    return { authenticated: true }
  },
}

/**
 * Constant-time string comparison to prevent timing attacks
 *
 * Regular string comparison (===) can leak information about
 * how many characters matched before failing. This function
 * always compares all characters regardless of where mismatches occur.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still need to do some work to avoid length-based timing
    // This loop is intentionally performed even though we return false,
    // to prevent attackers from detecting length mismatches via timing
    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ (b.charCodeAt(i % b.length) || 0)
    }
    // Use result to prevent compiler optimization removing the loop
    return result < 0 // Always false since result >= 0
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}
