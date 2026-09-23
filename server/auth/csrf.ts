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
    const originHost = urlHost(origin)
    if (originHost === null) {
      return { allowed: false, reason: 'malformed origin' }
    }
    return isAllowedHost(originHost, allowedHosts)
      ? { allowed: true }
      : { allowed: false, reason: 'cross-origin' }
  }

  return { allowed: true }
}

/** host[:port] of an absolute URL, lower-cased; null if it does not parse. */
function urlHost(url: string): string | null {
  try {
    return new URL(url).host.toLowerCase()
  } catch {
    return null
  }
}

function isAllowedHost(host: string, allowedHosts: string[]): boolean {
  return allowedHosts.filter(Boolean).map((h) => h.toLowerCase()).includes(host)
}

export interface SameOriginCheckInput {
  secFetchSite?: string
  origin?: string
  referer?: string
  /** Hosts (host[:port]) this server is reachable at for this request */
  allowedHosts: string[]
}

/**
 * Positive evidence that a request (including a safe-method one such as a
 * top-level GET navigation) was issued by this app or by the user directly.
 *
 * Used where a GET has a side effect that SameSite cannot stop: a cross-site
 * top-level navigation still receives and applies the response's Set-Cookie
 * headers, so e.g. `location = 'https://ui/auth/logout'` from any site could
 * otherwise sign the user out.
 *
 * Unlike checkCsrf this fails closed: without any signal it returns false.
 *   - `Sec-Fetch-Site` present: only `same-origin` or `none` (typed URL,
 *     bookmark).
 *   - Else `Origin` or `Referer` whose host is this server's host.
 */
export function isSameOriginRequest({ secFetchSite, origin, referer, allowedHosts }: SameOriginCheckInput): boolean {
  if (secFetchSite) {
    return ALLOWED_FETCH_SITES.has(secFetchSite.trim().toLowerCase())
  }
  for (const url of [origin, referer]) {
    if (!url || url === 'null') continue
    const host = urlHost(url)
    if (host !== null) return isAllowedHost(host, allowedHosts)
  }
  return false
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/**
 * Hosts this server is reachable at for a request. req.host honours
 * X-Forwarded-Host when `trust proxy` is set; the raw Host header covers
 * proxies that preserve it instead.
 */
function requestHosts(req: Request): string[] {
  return [req.host, req.get('host') ?? '']
}

/** isSameOriginRequest() for an Express request. */
export function requestIsSameOrigin(req: Request): boolean {
  return isSameOriginRequest({
    secFetchSite: headerValue(req.headers['sec-fetch-site']),
    origin: headerValue(req.headers.origin),
    referer: headerValue(req.headers.referer),
    allowedHosts: requestHosts(req),
  })
}

/**
 * Express middleware. Mount on `/api/v1`.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const decision = checkCsrf({
    method: req.method,
    secFetchSite: headerValue(req.headers['sec-fetch-site']),
    origin: headerValue(req.headers.origin),
    allowedHosts: requestHosts(req),
  })

  if (!decision.allowed) {
    console.warn(`[CSRF] Rejected ${req.method} ${req.path}: ${decision.reason}`)
    res.status(403).json({ error: 'Cross-site request rejected' })
    return
  }

  next()
}
