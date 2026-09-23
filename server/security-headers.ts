/**
 * Security response headers (Content-Security-Policy).
 *
 * Kept out of server/index.ts so the policy can evolve without touching the proxy/auth code.
 * Wired in with a single `app.use(securityHeaders({ isDev }))`.
 *
 * The UI renders AI/MCP-generated content (Mermaid diagrams, markdown), so the CSP is the
 * last line of defense if a sanitizer ever misses something: no inline or eval'd script can
 * run, and nothing can be exfiltrated to a third-party origin via fetch/XHR/WebSocket.
 */
import type { RequestHandler } from 'express'

type Directives = Record<string, string[]>

/**
 * Production policy.
 *
 * - script-src 'self': the Vite build emits only external module scripts; no inline scripts,
 *   no eval. This is what blocks injected `<script>`, `onclick=`, and `javascript:` URLs.
 * - style-src 'unsafe-inline': required, and unavoidable without forking Mermaid. Mermaid
 *   renders each diagram with an inline `<style>` element and `style="..."` attributes on SVG
 *   elements (set via d3 `.attr('style', ...)`, i.e. setAttribute, which CSP governs). Inline
 *   styles cannot execute script; the residual risk is CSS-based UI redressing, which the
 *   DOMPurify pass over the SVG already limits.
 * - img-src 'self' data: blob: — Mermaid/icons use data: URIs. Remote images are deliberately
 *   not allowed: AI/knowledge-base markdown could otherwise beacon data to arbitrary hosts.
 * - connect-src 'self': every API call goes through this Express proxy.
 * - frame-ancestors 'none': the UI holds an auth token; don't allow it to be framed.
 */
const PRODUCTION_DIRECTIVES: Directives = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'blob:'],
  'font-src': ["'self'", 'data:'],
  'connect-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
}

/**
 * Development relaxations (Vite middleware mode). Never applied in production.
 * - script-src 'unsafe-inline': @vitejs/plugin-react injects an inline React Refresh preamble.
 * - script-src 'unsafe-eval' (COVERAGE=true only): istanbul-instrumented modules call
 *   `new Function('return this')` to find the global coverage object.
 * - connect-src ws:/wss:: Vite's HMR client connects over a WebSocket on its own port.
 */
function developmentDirectives(coverage: boolean): Directives {
  return {
    ...PRODUCTION_DIRECTIVES,
    'script-src': ["'self'", "'unsafe-inline'", ...(coverage ? ["'unsafe-eval'"] : [])],
    'connect-src': ["'self'", 'ws:', 'wss:'],
  }
}

export function buildContentSecurityPolicy(isDev: boolean, coverage = false): string {
  const directives = isDev ? developmentDirectives(coverage) : PRODUCTION_DIRECTIVES
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ')
}

export function securityHeaders({ isDev }: { isDev: boolean }): RequestHandler {
  const policy = buildContentSecurityPolicy(isDev, process.env.COVERAGE === 'true')
  return (_req, res, next) => {
    res.setHeader('Content-Security-Policy', policy)
    next()
  }
}
