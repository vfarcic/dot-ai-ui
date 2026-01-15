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
  /** Current auth strategy name (e.g., 'bearer') */
  strategy: string | null
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

/**
 * Authentication Provider
 *
 * Wraps the app and provides authentication state/methods.
 * On mount, checks if auth is enabled and validates any stored token.
 *
 * Usage:
 *   <AuthProvider>
 *     <App />
 *   </AuthProvider>
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authEnabled, setAuthEnabled] = useState(false)
  const [strategy, setStrategy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus()
  }, [])

  /**
   * Check if auth is enabled and validate stored token
   */
  const checkAuthStatus = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // First, check if auth is enabled
      const statusRes = await fetch('/api/v1/auth/status')
      const statusData = await statusRes.json()

      setAuthEnabled(statusData.authEnabled)
      setStrategy(statusData.strategy)

      if (!statusData.authEnabled) {
        // Auth disabled - user is automatically authenticated
        setIsAuthenticated(true)
        setIsLoading(false)
        return
      }

      // Auth is enabled - check for stored token
      const storedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY)

      if (storedToken) {
        // Validate stored token
        const valid = await validateToken(storedToken)
        if (valid) {
          setToken(storedToken)
          setIsAuthenticated(true)
        } else {
          // Token invalid - clear it
          sessionStorage.removeItem(TOKEN_STORAGE_KEY)
        }
      }
    } catch (err) {
      console.error('[Auth] Failed to check auth status:', err)
      setError('Failed to connect to server')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Validate a token against the server
   */
  const validateToken = async (tokenToValidate: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/v1/auth/verify', {
        headers: {
          Authorization: `Bearer ${tokenToValidate}`,
        },
      })
      return res.ok
    } catch {
      return false
    }
  }

  /**
   * Attempt to authenticate with a token
   */
  const login = useCallback(async (newToken: string): Promise<boolean> => {
    setError(null)

    if (!newToken.trim()) {
      setError('Token cannot be empty')
      return false
    }

    const valid = await validateToken(newToken)

    if (valid) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, newToken)
      setToken(newToken)
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
    setToken(null)
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
        strategy,
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
