/**
 * Dashboard API Client
 * Fetches Kubernetes resource data from the MCP server
 */

const API_PATH = '/api/v1'

export interface ResourceKind {
  kind: string
  apiGroup: string
  apiVersion: string
  count: number
}

export interface ResourceKindsResponse {
  kinds: ResourceKind[]
}

/**
 * Fetch all resource kinds available in the cluster
 * Groups resources by apiGroup for sidebar display
 * @param namespace - Optional namespace to filter resource counts
 */
export async function getResourceKinds(namespace?: string): Promise<ResourceKind[]> {
  const params = new URLSearchParams()
  if (namespace) {
    params.set('namespace', namespace)
  }

  const queryString = params.toString()
  const url = `${API_PATH}/resources/kinds${queryString ? `?${queryString}` : ''}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch resource kinds: ${response.status} ${response.statusText}`)
  }

  const json = await response.json()
  return json.data?.kinds || []
}

/**
 * Group resource kinds by apiGroup for sidebar display
 * Empty apiGroup (core resources) is mapped to "core"
 */
export function groupKindsByApiGroup(kinds: ResourceKind[]): Map<string, ResourceKind[]> {
  const groups = new Map<string, ResourceKind[]>()

  for (const kind of kinds) {
    const groupName = kind.apiGroup || 'core'
    const existing = groups.get(groupName) || []
    existing.push(kind)
    groups.set(groupName, existing)
  }

  // Sort kinds within each group alphabetically
  for (const [groupName, groupKinds] of groups) {
    groups.set(groupName, groupKinds.sort((a, b) => a.kind.localeCompare(b.kind)))
  }

  return groups
}

/**
 * Sort API groups for display
 * "core" comes first, then alphabetically
 */
export function sortApiGroups(groups: string[]): string[] {
  return groups.sort((a, b) => {
    if (a === 'core') return -1
    if (b === 'core') return 1
    return a.localeCompare(b)
  })
}

// ============================================================================
// Namespaces API
// ============================================================================

export interface NamespacesResponse {
  namespaces: string[]
}

/**
 * Fetch all namespaces available in the cluster
 */
export async function getNamespaces(): Promise<string[]> {
  const response = await fetch(`${API_PATH}/namespaces`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch namespaces: ${response.status} ${response.statusText}`)
  }

  const json = await response.json()
  return json.data?.namespaces || []
}

// ============================================================================
// Resource List API
// ============================================================================

export interface Resource {
  name: string
  namespace?: string
  kind: string
  apiGroup: string
  apiVersion: string
  labels?: Record<string, string>
  createdAt: string
}

export interface ResourcesResponse {
  resources: Resource[]
  total: number
}

export interface GetResourcesParams {
  kind: string
  apiGroup: string
  apiVersion: string
  namespace?: string
  limit?: number
  offset?: number
}

/**
 * Fetch resources of a specific kind from the cluster
 * Data comes from Qdrant via MCP server
 */
export async function getResources(params: GetResourcesParams): Promise<ResourcesResponse> {
  const { kind, apiGroup, apiVersion, namespace, limit = 100, offset = 0 } = params

  const queryParams = new URLSearchParams({
    kind,
    apiVersion,
    limit: String(limit),
    offset: String(offset),
  })

  // Only add apiGroup if non-empty (core resources have empty apiGroup)
  if (apiGroup) {
    queryParams.set('apiGroup', apiGroup)
  }

  if (namespace) {
    queryParams.set('namespace', namespace)
  }

  const response = await fetch(`${API_PATH}/resources?${queryParams}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch resources: ${response.status} ${response.statusText}`)
  }

  const json = await response.json()
  return {
    resources: json.data?.resources || [],
    total: json.data?.total || 0,
  }
}
