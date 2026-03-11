import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { buildAuthorizeUrl, exchangeCode, ensureRegistered } from './oauth-client.js'

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * Create Express router for OAuth browser login flow.
 *
 * Routes:
 *   GET /auth/login    - Initiate OAuth flow (redirect to Dex via dot-ai)
 *   GET /auth/callback - Handle OAuth callback (exchange code for token)
 *   GET /auth/logout   - Clear session and redirect to login
 */
export function createOAuthRouter(): Router {
  const router = Router()

  /**
   * GET /auth/login
   *
   * Redirects the browser to the dot-ai authorization endpoint.
   * Generates PKCE challenge and stores verifier for the callback.
   */
  router.get('/auth/login', authLimiter, async (req, res) => {
    try {
      const callbackUrl = `${req.protocol}://${req.get('host')}/auth/callback`
      await ensureRegistered(callbackUrl)
      const authorizeUrl = buildAuthorizeUrl()
      res.redirect(authorizeUrl)
    } catch (err) {
      console.error('[OAuth] Failed to build authorize URL:', err)
      res.status(500).json({ error: 'Failed to initiate OAuth login' })
    }
  })

  /**
   * GET /auth/callback
   *
   * Receives the authorization code from dot-ai after Dex authentication.
   * Exchanges the code for a JWT access token, then redirects the browser
   * to the frontend with the token in a URL fragment.
   */
  router.get('/auth/callback', authLimiter, async (req, res) => {
    const { code, state, error, error_description } = req.query as {
      code?: string
      state?: string
      error?: string
      error_description?: string
    }

    // Handle OAuth error response
    if (error) {
      console.error(`[OAuth] Authorization error: ${error} - ${error_description}`)
      res.redirect(`/dashboard?auth_error=${encodeURIComponent(error_description || error)}`)
      return
    }

    if (!code || !state) {
      res.status(400).json({ error: 'Missing code or state parameter' })
      return
    }

    try {
      const { accessToken } = await exchangeCode(code, state)

      // Redirect to frontend with token in URL fragment (not query string)
      // Fragment is not sent to the server on subsequent requests
      res.redirect(`/auth/complete#token=${accessToken}`)
    } catch (err) {
      console.error('[OAuth] Token exchange failed:', err)
      const message = err instanceof Error ? err.message : 'Token exchange failed'
      res.redirect(`/dashboard?auth_error=${encodeURIComponent(message)}`)
    }
  })

  /**
   * GET /auth/logout
   *
   * Clears the session and redirects to the login page.
   * The frontend handles clearing sessionStorage.
   */
  router.get('/auth/logout', (_req, res) => {
    res.redirect('/')
  })

  return router
}
