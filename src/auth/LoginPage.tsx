import React, { useState } from 'react'
import { useAuth } from './AuthContext'

/**
 * Login Page
 *
 * Simple token input form shown when authentication is required.
 * Uses the dashboard's design system for consistent styling.
 */
export function LoginPage() {
  const { login, error: authError, strategy } = useAuth()
  const [token, setToken] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const error = localError || authError

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    setIsSubmitting(true)

    try {
      const success = await login(token)
      if (!success) {
        // Error will be set by login()
      }
    } catch (err) {
      setLocalError('Failed to authenticate')
    } finally {
      setIsSubmitting(false)
    }
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

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="bg-muted rounded-lg p-6 border border-border">
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

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-md text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Submit Button */}
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

          {/* Strategy Info */}
          {strategy && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Authentication method: {strategy}
            </p>
          )}
        </form>

        {/* Help Text */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Check the server logs for the auto-generated token, or set DOT_AI_UI_AUTH_TOKEN.
        </p>
      </div>
    </div>
  )
}
