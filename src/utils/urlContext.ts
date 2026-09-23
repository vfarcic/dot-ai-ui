/**
 * Build the AI prompt context from the current URL (route params + query params).
 *
 * URLs are attacker-controllable (anyone can send a victim a crafted link), and this context is
 * pasted into the prompt sent to the AI tools. So only a fixed set of keys is used, and every
 * value must look like the Kubernetes identifier it claims to be. Anything else is dropped.
 */

type ContextField = 'kind' | 'group' | 'namespace' | 'name'

// DNS-1123 label: namespaces.
const DNS_LABEL = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/
// DNS-1123 subdomain: API groups.
const DNS_SUBDOMAIN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/
// Kinds are CamelCase identifiers (e.g. Deployment, CompositeResourceDefinition).
const KIND = /^[A-Za-z][A-Za-z0-9]*$/
// Most resource names are DNS subdomains, but some kinds allow more (e.g. RBAC's
// `system:controller:foo`). Allow that charset without whitespace, quotes or newlines.
const RESOURCE_NAME = /^[A-Za-z0-9]([A-Za-z0-9._:-]*[A-Za-z0-9])?$/

const VALIDATORS: Record<ContextField, { pattern: RegExp; maxLength: number }> = {
  kind: { pattern: KIND, maxLength: 63 },
  group: { pattern: DNS_SUBDOMAIN, maxLength: 253 },
  namespace: { pattern: DNS_LABEL, maxLength: 63 },
  name: { pattern: RESOURCE_NAME, maxLength: 253 },
}

/** Query param key -> context field. Keys not listed here are never included. */
const QUERY_PARAM_FIELDS = new Map<string, ContextField>([
  ['kind', 'kind'],
  ['group', 'group'],
  ['ns', 'namespace'],
  ['name', 'name'],
])

/** Route placeholders meaning "not applicable" (see the /dashboard/:group/... route). */
const ROUTE_SENTINELS: Partial<Record<ContextField, string>> = {
  group: '_core',
  namespace: '_cluster',
}

export function isValidContextValue(field: ContextField, value: string): boolean {
  const { pattern, maxLength } = VALIDATORS[field]
  return value.length <= maxLength && pattern.test(value)
}

/**
 * Extract context from URL params (both route and query params).
 * Returns YAML-like `field: value` lines (without header prefix).
 * Route params win over query params for the same field.
 */
export function extractUrlContext(
  routeParams: Record<string, string | undefined>,
  searchParams: URLSearchParams
): string {
  const context = new Map<ContextField, string>()

  // Route: /dashboard/:group/:version/:kind/:namespace/:name
  for (const field of ['kind', 'group', 'namespace', 'name'] as const) {
    const value = routeParams[field]
    if (!value || value === ROUTE_SENTINELS[field]) continue
    if (isValidContextValue(field, value)) context.set(field, value)
  }

  // Query params (resource list page)
  searchParams.forEach((value, key) => {
    const field = QUERY_PARAM_FIELDS.get(key)
    if (!field) return
    if (context.has(field) || routeParams[field]) return
    if (isValidContextValue(field, value)) context.set(field, value)
  })

  return (['kind', 'group', 'namespace', 'name'] as const)
    .filter(field => context.has(field))
    .map(field => `${field}: ${context.get(field)}`)
    .join('\n')
}
