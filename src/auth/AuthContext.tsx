import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

/**
 * Authentication state and methods
 */
interface AuthContextType {
  /** Whether auth check is in progress */
  isLoading: boolean
  /** Whether user is authenticated (or auth is disabled) */
  isAuthenticated: boolean
  /** Whether server has auth enabled */
  authEnabled: boolean
  /** Whether OAuth SSO login is available */
  oauthEnabled: boolean
  /** Current auth strategy name (e.g., 'bearer') */
  strategy: string | null
  /** Auth mode: 'oauth' for SSO, 'token' for bearer token */
  authMode: 'oauth' | 'token' | null
  /** User email (OAuth users only) */
  userEmail: string | null
  /** Error message from last auth attempt */
  error: string | null
  /** Attempt to authenticate with a token */
  login: (token: string) => Promise<boolean>
  /** Clear authentication */
  logout: () => void
  /** Get the current token (for API requests) */
  getToken: () => string | null
}

const AuthContext = createContext<AuthContextType | null>(null)

const TOKEN_STORAGE_KEY = 'dot-ai-ui-auth-token'
const AUTH_MODE_KEY = 'dot-ai-ui-auth-mode'
const USER_EMAIL_KEY = 'dot-ai-ui-user-email'

/**
 * Decode a JWT payload client-side to extract user info (email, sub).
 * No signature verification — the token is trusted because it came from
 * the server-side OAuth code exchange.
 */
function decodeJwtPayload(token: string): { sub?: string; email?: string; exp?: number } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(payload)
  } catch {
    return null
  }
}

/**
 * Authentication Provider
 *
 * Wraps the app and provides authentication state/methods.
 * On mount, checks if auth is enabled and validates any stored token.
 * Handles OAuth callback tokens from URL fragments.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authEnabled, setAuthEnabled] = useState(false)
  const [oauthEnabled, setOauthEnabled] = useState(false)
  const [strategy, setStrategy] = useState<string | null>(null)
  const [authMode, setAuthMode] = useState<'oauth' | 'token' | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus()
  }, [])

  /**
   * Check for OAuth callback token in URL fragment or query params.
   * Returns { token, error } — at most one will be set.
   */
  const handleOAuthCallback = (): { token: string | null; error: string | null } => {
    // Check /auth/complete#token=... (fragment-based)
    if (window.location.pathname === '/auth/complete' && window.location.hash) {
      const params = new URLSearchParams(window.location.hash.slice(1))
      const callbackToken = params.get('token')
      if (callbackToken) {
        return { token: callbackToken, error: null }
      }
    }

    // Check for auth error in query string
    const searchParams = new URLSearchParams(window.location.search)
    const authError = searchParams.get('auth_error')
    if (authError) {
      const cleanUrl = window.location.pathname
      window.history.replaceState({}, '', cleanUrl)
      return { token: null, error: authError }
    }

    return { token: null, error: null }
  }

  /**
   * Check if auth is enabled and validate stored token
   */
  const checkAuthStatus = async () => {
    setIsLoading(true)
    setError(null)

    // Check for OAuth callback token or error before async work
    const { token: oauthToken, error: oauthError } = handleOAuthCallback()

    try {

      // Check if auth is enabled
      const statusRes = await fetch('/api/v1/auth/status')
      if (!statusRes.ok) {
        throw new Error(`Auth status check failed: ${statusRes.status}`)
      }
      const statusData = await statusRes.json()

      if (typeof statusData.authEnabled !== 'boolean') {
        throw new Error('Invalid auth status response')
      }

      setAuthEnabled(statusData.authEnabled)
      setStrategy(statusData.strategy)
      setOauthEnabled(statusData.oauthEnabled || false)

      if (!statusData.authEnabled) {
        setIsAuthenticated(true)
        setIsLoading(false)
        return
      }

      // If we got an OAuth callback token, trust it (it came from server-side code exchange)
      if (oauthToken) {
        sessionStorage.setItem(TOKEN_STORAGE_KEY, oauthToken)
        sessionStorage.setItem(AUTH_MODE_KEY, 'oauth')
        const payload = decodeJwtPayload(oauthToken)
        if (payload?.email) {
          sessionStorage.setItem(USER_EMAIL_KEY, payload.email)
        }
        // Full navigation to dashboard so the router initializes with the correct URL
        window.location.replace('/dashboard')
        return
      }

      // Check for stored token
      const storedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY)
      const storedMode = sessionStorage.getItem(AUTH_MODE_KEY) as 'oauth' | 'token' | null
      const storedEmail = sessionStorage.getItem(USER_EMAIL_KEY)

      if (storedToken) {
        if (storedMode === 'oauth') {
          // OAuth JWT — trust it, check expiry client-side
          const payload = decodeJwtPayload(storedToken)
          if (!payload || !payload.exp || payload.exp * 1000 < Date.now()) {
            // Token malformed or expired, clear it
            sessionStorage.removeItem(TOKEN_STORAGE_KEY)
            sessionStorage.removeItem(AUTH_MODE_KEY)
            sessionStorage.removeItem(USER_EMAIL_KEY)
          } else {
            setToken(storedToken)
            setAuthMode('oauth')
            setUserEmail(payload.email || storedEmail || null)
            setIsAuthenticated(true)
          }
        } else {
          // Bearer token — validate with server
          const valid = await validateToken(storedToken)
          if (valid.authenticated) {
            setToken(storedToken)
            setAuthMode('token')
            setUserEmail(null)
            setIsAuthenticated(true)
          } else {
            sessionStorage.removeItem(TOKEN_STORAGE_KEY)
            sessionStorage.removeItem(AUTH_MODE_KEY)
            sessionStorage.removeItem(USER_EMAIL_KEY)
          }
        }
      }
    } catch (err) {
      console.error('[Auth] Failed to check auth status:', err)
      setError('Failed to connect to server')
    } finally {
      if (oauthError) {
        setError(oauthError)
      }
      setIsLoading(false)
    }
  }

  /**
   * Validate a token against the server
   */
  const validateToken = async (
    tokenToValidate: string
  ): Promise<{ authenticated: boolean; userEmail?: string }> => {
    try {
      const res = await fetch('/api/v1/auth/verify', {
        headers: {
          Authorization: `Bearer ${tokenToValidate}`,
        },
      })
      if (!res.ok) return { authenticated: false }
      const data = await res.json()
      return {
        authenticated: data.authenticated,
        userEmail: data.userEmail,
      }
    } catch {
      return { authenticated: false }
    }
  }

  /**
   * Attempt to authenticate with a bearer token
   */
  const login = useCallback(async (newToken: string): Promise<boolean> => {
    setError(null)

    if (!newToken.trim()) {
      setError('Token cannot be empty')
      return false
    }

    const valid = await validateToken(newToken)

    if (valid.authenticated) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, newToken)
      sessionStorage.setItem(AUTH_MODE_KEY, 'token')
      setToken(newToken)
      setAuthMode('token')
      setIsAuthenticated(true)
      return true
    } else {
      setError('Invalid token')
      return false
    }
  }, [])

  /**
   * Clear authentication and stored token
   */
  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY)
    sessionStorage.removeItem(AUTH_MODE_KEY)
    sessionStorage.removeItem(USER_EMAIL_KEY)
    setToken(null)
    setAuthMode(null)
    setUserEmail(null)
    setIsAuthenticated(false)
  }, [])

  /**
   * Get the current token for API requests
   */
  const getToken = useCallback(() => {
    return token || sessionStorage.getItem(TOKEN_STORAGE_KEY)
  }, [token])

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        isAuthenticated,
        authEnabled,
        oauthEnabled,
        strategy,
        authMode,
        userEmail,
        error,
        login,
        logout,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Hook to access authentication context
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
