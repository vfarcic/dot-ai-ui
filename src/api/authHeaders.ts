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
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: 'same-origin',
  })
}
