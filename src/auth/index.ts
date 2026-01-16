/**
 * Authentication Module
 *
 * This module provides frontend authentication for the dashboard.
 * It's designed to be easily replaceable when implementing more
 * sophisticated auth (OAuth/OIDC, etc.).
 *
 * To remove auth:
 * 1. Remove AuthProvider from main.tsx
 * 2. Remove AuthGuard from App.tsx
 * 3. Delete this directory
 *
 * To extend auth:
 * 1. Add new strategy in server/auth/strategies/
 * 2. Update AuthContext to handle new auth flow if needed
 * 3. Update LoginPage for different input types (e.g., OAuth redirect)
 */

export { AuthProvider, useAuth } from './AuthContext'
export { AuthGuard } from './AuthGuard'
export { LoginPage } from './LoginPage'
