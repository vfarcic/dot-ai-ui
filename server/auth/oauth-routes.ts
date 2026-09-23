import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { buildAuthorizeUrl, exchangeCode, ensureRegistered } from './oauth-client.js'
import {
  setSessionCookie,
  clearSessionCookie,
  oauthCookieMaxAge,
  isJwtShaped,
  isSecureRequest,
  setOAuthStateCookie,
  clearOAuthStateCookie,
  oauthStateMatches,
  MAX_CREDENTIAL_LENGTH,
} from './session.js'

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
 *   GET /auth/logout   - Clear the session cookie and redirect to login
 */
export function createOAuthRouter(): Router {
  const router = Router()

  /**
   * GET /auth/login
   *
   * Redirects the browser to the dot-ai authorization endpoint.
   * Generates PKCE challenge and stores verifier for the callback, and binds
   * the request's `state` to this browser with a short-lived cookie.
   */
  router.get('/auth/login', authLimiter, async (req, res) => {
    try {
      // With DOT_AI_UI_SECURE_COOKIES=true the public URL is HTTPS even if the
      // hop in front of this server says otherwise.
      const protocol = isSecureRequest(req) ? 'https' : req.protocol
      const callbackUrl = `${protocol}://${req.get('host')}/auth/callback`
      await ensureRegistered(callbackUrl)
      const { authorizeUrl, state } = buildAuthorizeUrl()
      setOAuthStateCookie(req, res, state)
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
   * Only redeems the code when `state` matches the cookie set by /auth/login
   * in this browser (login CSRF protection). Exchanges the code for a JWT
   * access token, stores it in the HttpOnly session cookie and redirects to
   * the dashboard; the token never appears in a URL.
   */
  router.get('/auth/callback', authLimiter, async (req, res) => {
    const { code, state, error, error_description } = req.query as {
      code?: string
      state?: string
      error?: string
      error_description?: string
    }

    // The binding cookie is single-use, whatever the outcome
    clearOAuthStateCookie(res)

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

    // Refuse a code+state pair this browser did not start (e.g. a link from an
    // attacker who began the login with their own account). The code is not
    // redeemed and any existing session is left untouched.
    if (!oauthStateMatches(req, state)) {
      console.warn('[OAuth] Callback state does not match this browser; refusing to sign in')
      res.redirect(`/dashboard?auth_error=${encodeURIComponent('Sign-in was not started from this browser. Please try again.')}`)
      return
    }

    try {
      const { accessToken, expiresIn } = await exchangeCode(code, state)

      if (
        typeof accessToken !== 'string' ||
        !isJwtShaped(accessToken) ||
        accessToken.length > MAX_CREDENTIAL_LENGTH
      ) {
        throw new Error('Authorization server returned an unusable access token')
      }

      setSessionCookie(req, res, accessToken, oauthCookieMaxAge(accessToken, expiresIn))
      res.redirect('/dashboard')
    } catch (err) {
      console.error('[OAuth] Token exchange failed:', err)
      const message = err instanceof Error ? err.message : 'Token exchange failed'
      res.redirect(`/dashboard?auth_error=${encodeURIComponent(message)}`)
    }
  })

  /**
   * GET /auth/logout
   *
   * Clears the session cookie and redirects to the login page. The browser
   * app signs out with POST /api/v1/auth/logout; this GET remains for links.
   */
  router.get('/auth/logout', (req, res) => {
    clearSessionCookie(req, res)
    res.redirect('/')
  })

  return router
}
