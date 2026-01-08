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
 */
export async function getResourceKinds(): Promise<ResourceKind[]> {
  const response = await fetch(`${API_PATH}/resources/kinds`, {
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
