import type { Request, Response, NextFunction } from 'express'

/**
 * CSRF defence-in-depth for state-changing API requests.
 *
 * The primary defence is the SameSite=Strict session cookie: browsers do not
 * attach it to cross-site requests. This middleware additionally rejects
 * POST/PUT/PATCH/DELETE requests whose Fetch Metadata or Origin header shows
 * they were issued by another site, which also covers same-site (sibling
 * subdomain) requests that SameSite does not block.
 *
 * Rules, most authoritative first:
 *   - `Sec-Fetch-Site` present (all current browsers): allow only
 *     `same-origin` and `none` (user-initiated, e.g. typed URL).
 *   - Else `Origin` present: its host must equal the request host.
 *     `Origin: null` (sandboxed/opaque contexts) is rejected.
 *   - Neither present: not a browser-driven cross-site request (curl, scripts,
 *     server-to-server). Allowed; such clients authenticate with an
 *     Authorization header, which browsers never attach cross-site.
 */

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const ALLOWED_FETCH_SITES = new Set(['same-origin', 'none'])

export interface CsrfCheckInput {
  method: string
  secFetchSite?: string
  origin?: string
  /** Hosts (host[:port]) this server is reachable at for this request */
  allowedHosts: string[]
}

export type CsrfDecision = { allowed: true } | { allowed: false; reason: string }

export function checkCsrf({ method, secFetchSite, origin, allowedHosts }: CsrfCheckInput): CsrfDecision {
  if (!STATE_CHANGING_METHODS.has(method.toUpperCase())) {
    return { allowed: true }
  }

  if (secFetchSite) {
    const site = secFetchSite.trim().toLowerCase()
    return ALLOWED_FETCH_SITES.has(site)
      ? { allowed: true }
      : { allowed: false, reason: `Sec-Fetch-Site: ${site}` }
  }

  if (origin !== undefined) {
    if (origin === 'null') {
      return { allowed: false, reason: 'opaque origin' }
    }
    let originHost: string
    try {
      originHost = new URL(origin).host.toLowerCase()
    } catch {
      return { allowed: false, reason: 'malformed origin' }
    }
    const hosts = allowedHosts.filter(Boolean).map((h) => h.toLowerCase())
    return hosts.includes(originHost)
      ? { allowed: true }
      : { allowed: false, reason: 'cross-origin' }
  }

  return { allowed: true }
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/**
 * Express middleware. Mount on `/api/v1`.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const decision = checkCsrf({
    method: req.method,
    secFetchSite: headerValue(req.headers['sec-fetch-site']),
    origin: headerValue(req.headers.origin),
    // req.host honours X-Forwarded-Host when `trust proxy` is set; the raw
    // Host header covers proxies that preserve it instead.
    allowedHosts: [req.host, req.get('host') ?? ''],
  })

  if (!decision.allowed) {
    console.warn(`[CSRF] Rejected ${req.method} ${req.path}: ${decision.reason}`)
    res.status(403).json({ error: 'Cross-site request rejected' })
    return
  }

  next()
}
