/**
 * Authenticated fetch
 *
 * The session credential lives in an HttpOnly cookie set by the server
 * (POST /api/v1/auth/login or the OAuth callback). Page script never sees it
 * and never builds an Authorization header; the browser attaches the cookie
 * to same-origin requests on its own.
 *
 * Usage:
 *   const response = await fetchWithAuth('/api/v1/resources')
 *   const response = await fetchWithAuth('/api/v1/tools/query', {
 *     method: 'POST',
 *     body: JSON.stringify({ intent: '...' }),
 *   })
 */
/**
 * Window event fired when an API call comes back 401. The cookie can vanish
 * under a live tab (its lifetime ran out, or another tab signed out), so
 * AuthProvider listens for this and re-checks the session with the server.
 */
export const AUTH_REQUIRED_EVENT = 'dot-ai-ui:auth-required'

export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    credentials: 'same-origin',
  })
  if (response.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT))
  }
  return response
}
