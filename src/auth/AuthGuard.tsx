import React from 'react'
import { useAuth } from './AuthContext'
import { LoginPage } from './LoginPage'

/**
 * Loading spinner shown during auth check
 */
function AuthLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <svg
          className="animate-spin h-8 w-8 text-primary mx-auto mb-4"
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
        <p className="text-muted-foreground text-sm">Checking authentication...</p>
      </div>
    </div>
  )
}

/**
 * Auth Guard Component
 *
 * Wraps protected content and handles auth states:
 * - Loading: Shows spinner while checking auth
 * - Not authenticated: Shows login page
 * - Authenticated: Renders children
 *
 * Usage:
 *   <AuthGuard>
 *     <ProtectedContent />
 *   </AuthGuard>
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth()

  if (isLoading) {
    return <AuthLoading />
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return <>{children}</>
}
