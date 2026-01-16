/**
 * Auth Headers Utility
 *
 * Provides authentication headers for API requests.
 * This file can be deleted when switching to a different auth mechanism.
 *
 * The token is stored in sessionStorage by the AuthContext.
 */

const TOKEN_STORAGE_KEY = 'dot-ai-ui-auth-token'

/**
 * Get authentication headers for API requests
 *
 * Returns an object with Authorization header if token exists,
 * or empty object if no token (auth disabled).
 *
 * Usage:
 *   fetch('/api/v1/resources', {
 *     headers: {
 *       ...getAuthHeaders(),
 *       'Content-Type': 'application/json',
 *     },
 *   })
 */
export function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem(TOKEN_STORAGE_KEY)
  if (token) {
    return { Authorization: `Bearer ${token}` }
  }
  return {}
}

/**
 * Enhanced fetch that automatically includes auth headers
 *
 * Usage:
 *   const response = await fetchWithAuth('/api/v1/resources')
 *   const response = await fetchWithAuth('/api/v1/tools/query', {
 *     method: 'POST',
 *     body: JSON.stringify({ intent: '...' }),
 *   })
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const authHeaders = getAuthHeaders()

  return fetch(url, {
    ...options,
    headers: {
      ...authHeaders,
      ...options.headers,
    },
  })
}
