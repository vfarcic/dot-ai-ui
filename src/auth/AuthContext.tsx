import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { AUTH_REQUIRED_EVENT } from '@/api/authHeaders'

/**
 * Authentication state and methods
 *
 * The credential itself lives in an HttpOnly session cookie managed by the
 * server, so nothing here can read it. The app learns its session state from
 * GET /api/v1/auth/session.
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
  /** Clear authentication (server clears the session cookie) */
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

/** Shown on the login page when a live session ends under an open tab */
export const SESSION_ENDED_MESSAGE = 'Your session has ended. Please sign in again.'

/**
 * Keys earlier releases used to keep the token in sessionStorage. Removed on
 * startup so a tab that survives an upgrade does not keep a readable token.
 */
const LEGACY_STORAGE_KEYS = ['dot-ai-ui-auth-token', 'dot-ai-ui-auth-mode', 'dot-ai-ui-user-email']

function clearLegacyStorage(): void {
  try {
    for (const key of LEGACY_STORAGE_KEYS) {
      sessionStorage.removeItem(key)
    }
  } catch {
    // Storage can be unavailable (privacy mode); nothing to clean up then.
  }
}

/** Shape of GET /api/v1/auth/session and POST /api/v1/auth/login responses */
interface SessionResponse {
  authenticated: boolean
  authEnabled?: boolean
  mode?: 'oauth' | 'token'
  email?: string
  expiresAt?: number
  error?: string
}

async function fetchSession(): Promise<SessionResponse> {
  const res = await fetch('/api/v1/auth/session', {
    credentials: 'same-origin',
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`Session check failed: ${res.status}`)
  }
  return res.json()
}

/**
 * Read (and strip from the URL) an OAuth error the server passed back via
 * ?auth_error=... after a failed callback.
 */
function takeOAuthError(): string | null {
  const searchParams = new URLSearchParams(window.location.search)
  const authError = searchParams.get('auth_error')
  if (authError) {
    window.history.replaceState({}, '', window.location.pathname)
  }
  return authError
}

/**
 * Authentication Provider
 *
 * Wraps the app and provides authentication state/methods.
 * On mount, checks if auth is enabled and asks the server for the session.
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
  // Read once per mount: the URL is cleaned on first read, and StrictMode
  // runs the effect twice in development.
  const oauthErrorRef = useRef<string | null | undefined>(undefined)
  // Mirrors of state for the re-check listeners, which outlive a render
  const authEnabledRef = useRef(false)
  const isAuthenticatedRef = useRef(false)
  const initialCheckDoneRef = useRef(false)
  const recheckInFlightRef = useRef(false)
  // Bumped on every session change, so a re-check that started before a
  // login/logout cannot overwrite its result.
  const sessionGenerationRef = useRef(0)

  const applySession = useCallback((session: SessionResponse) => {
    sessionGenerationRef.current += 1
    isAuthenticatedRef.current = session.authenticated
    if (session.authenticated) {
      setAuthMode(session.mode ?? null)
      setUserEmail(session.mode === 'oauth' ? session.email ?? null : null)
      setIsAuthenticated(true)
    } else {
      setAuthMode(null)
      setUserEmail(null)
      setIsAuthenticated(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const checkAuthStatus = async () => {
      setIsLoading(true)
      setError(null)
      clearLegacyStorage()

      if (oauthErrorRef.current === undefined) {
        oauthErrorRef.current = takeOAuthError()
      }
      const oauthError = oauthErrorRef.current

      try {
        const statusRes = await fetch('/api/v1/auth/status')
        if (!statusRes.ok) {
          throw new Error(`Auth status check failed: ${statusRes.status}`)
        }
        const statusData = await statusRes.json()

        if (typeof statusData.authEnabled !== 'boolean') {
          throw new Error('Invalid auth status response')
        }
        if (cancelled) return

        setAuthEnabled(statusData.authEnabled)
        authEnabledRef.current = statusData.authEnabled
        setStrategy(statusData.strategy)
        setOauthEnabled(statusData.oauthEnabled || false)

        if (!statusData.authEnabled) {
          setIsAuthenticated(true)
          return
        }

        const session = await fetchSession()
        if (cancelled) return
        applySession(session)
        initialCheckDoneRef.current = true
      } catch (err) {
        console.error('[Auth] Failed to check auth status:', err)
        if (!cancelled) setError('Failed to connect to server')
      } finally {
        if (!cancelled) {
          if (oauthError) {
            setError(oauthError)
          }
          setIsLoading(false)
        }
      }
    }

    checkAuthStatus()
    return () => {
      cancelled = true
    }
  }, [applySession])

  /**
   * Re-check the session with the server. Triggered by a 401 from any API
   * call and whenever the tab becomes visible again, because the cookie is
   * shared across tabs and can expire or be cleared under this one. If the
   * session is gone, the guard falls back to the login page.
   */
  useEffect(() => {
    const recheck = async () => {
      if (!initialCheckDoneRef.current || !authEnabledRef.current || recheckInFlightRef.current) return
      recheckInFlightRef.current = true
      try {
        const generation = sessionGenerationRef.current
        const wasAuthenticated = isAuthenticatedRef.current
        const session = await fetchSession()
        if (generation !== sessionGenerationRef.current) return
        applySession(session)
        if (wasAuthenticated && !session.authenticated) setError(SESSION_ENDED_MESSAGE)
        if (!wasAuthenticated && session.authenticated) setError(null)
      } catch {
        // Server unreachable: keep the current state; the failing call shows its own error
      } finally {
        recheckInFlightRef.current = false
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void recheck()
    }

    window.addEventListener(AUTH_REQUIRED_EVENT, recheck)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener(AUTH_REQUIRED_EVENT, recheck)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [applySession])

  /**
   * Sign in with the static UI token. The server validates it and sets the
   * HttpOnly session cookie; the token is not kept anywhere in the page.
   */
  const login = useCallback(async (newToken: string): Promise<boolean> => {
    setError(null)

    if (!newToken.trim()) {
      setError('Token cannot be empty')
      return false
    }

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: newToken }),
      })
      const data: SessionResponse = await res.json().catch(() => ({ authenticated: false }))

      if (res.ok && data.authenticated) {
        applySession(data)
        return true
      }

      setError(res.status === 429 ? 'Too many attempts, please try again later' : 'Invalid token')
      return false
    } catch {
      setError('Failed to connect to server')
      return false
    }
  }, [applySession])

  /**
   * Sign out: the server clears the session cookie.
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin' })
    } catch (err) {
      console.error('[Auth] Logout request failed:', err)
    } finally {
      clearLegacyStorage()
      applySession({ authenticated: false })
    }
  }, [applySession])

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
