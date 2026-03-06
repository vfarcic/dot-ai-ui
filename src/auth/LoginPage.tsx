import React, { useState } from 'react'
import { useAuth } from './AuthContext'

/**
 * Login Page
 *
 * Two login modes:
 * - SSO (default when OAuth is available): "Login with SSO" button redirects to Dex
 * - Token: existing password input field for bearer token auth
 */
export function LoginPage() {
  const { login, error: authError, oauthEnabled } = useAuth()
  const [mode, setMode] = useState<'sso' | 'token'>(oauthEnabled ? 'sso' : 'token')
  const [token, setToken] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const error = localError || authError

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    setIsSubmitting(true)

    try {
      const success = await login(token)
      if (!success) {
        // Error will be set by login()
      }
    } catch {
      setLocalError('Failed to authenticate')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSsoLogin = () => {
    window.location.href = '/auth/login'
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">DevOps AI Toolkit</h1>
          <p className="text-muted-foreground text-sm">
            Authentication required to access the Kubernetes dashboard
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-muted rounded-lg p-6 border border-border">
          {/* Mode Tabs (only show if OAuth is available) */}
          {oauthEnabled && (
            <div className="flex mb-6 bg-background rounded-md p-1">
              <button
                type="button"
                onClick={() => { setMode('sso'); setLocalError(null) }}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded transition-colors ${
                  mode === 'sso'
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                SSO
              </button>
              <button
                type="button"
                onClick={() => { setMode('token'); setLocalError(null) }}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded transition-colors ${
                  mode === 'token'
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Token
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-md text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* SSO Mode */}
          {mode === 'sso' && oauthEnabled && (
            <div>
              <p className="text-sm text-muted-foreground mb-4 text-center">
                Sign in with your organization's identity provider.
              </p>
              <button
                type="button"
                onClick={handleSsoLogin}
                className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
              >
                Login with SSO
              </button>
            </div>
          )}

          {/* Token Mode */}
          {(mode === 'token' || !oauthEnabled) && (
            <form onSubmit={handleTokenSubmit}>
              <div className="mb-4">
                <label htmlFor="token" className="block text-sm font-medium text-foreground mb-2">
                  Access Token
                </label>
                <input
                  id="token"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Enter your access token"
                  className="w-full px-4 py-3 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  autoFocus
                  disabled={isSubmitting}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !token.trim()}
                className="w-full py-3 px-4 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed text-primary-foreground font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Authenticating...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
