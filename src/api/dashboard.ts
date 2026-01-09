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
// Capabilities API
// ============================================================================

export interface PrinterColumn {
  name: string
  type: string
  jsonPath: string
  description?: string
  priority?: number
}

/**
 * Hardcoded printer columns for core Kubernetes resources
 * These resources don't have CRDs, so MCP can't fetch their columns dynamically
 * Only includes columns using data MCP returns: name, namespace, createdAt, status.*
 */
export const CORE_RESOURCE_COLUMNS: Record<string, PrinterColumn[]> = {
  'Pod/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Status', type: 'string', jsonPath: '.status.phase', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
  ],
  'Service/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
  ],
  'ConfigMap/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
  ],
  'Secret/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
  ],
  'Node/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Version', type: 'string', jsonPath: '.status.nodeInfo.kubeletVersion', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
  ],
  'Namespace/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Status', type: 'string', jsonPath: '.status.phase', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
  ],
  'ServiceAccount/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
  ],
  'Endpoints/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
  ],
  'PersistentVolume/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Status', type: 'string', jsonPath: '.status.phase', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
  ],
  'PersistentVolumeClaim/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Status', type: 'string', jsonPath: '.status.phase', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
  ],
  'Event/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
  ],
}

/**
 * Default fallback columns when no printer columns are available
 */
export const DEFAULT_COLUMNS: PrinterColumn[] = [
  { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
  { name: 'Namespace', type: 'string', jsonPath: '.metadata.namespace', priority: 0 },
  { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
]

/**
 * Get printer columns for a resource kind
 * Returns hardcoded columns for core resources, or null to fetch from MCP
 */
export function getCoreResourceColumns(kind: string, apiVersion: string): PrinterColumn[] | null {
  const key = `${kind}/${apiVersion}`
  return CORE_RESOURCE_COLUMNS[key] || null
}

export interface ResourceCapabilities {
  kind: string
  apiVersion: string
  printerColumns?: PrinterColumn[]
}

export interface GetCapabilitiesParams {
  kind: string
  apiVersion: string
}

export interface GetCapabilitiesResult {
  data: ResourceCapabilities | null
  error: boolean
}

/**
 * Fetch capabilities for a resource kind
 * Returns printer columns if available (from CRD additionalPrinterColumns or K8s Table API)
 * Returns { data, error } to distinguish between API errors and empty results
 */
export async function getCapabilities(params: GetCapabilitiesParams): Promise<GetCapabilitiesResult> {
  const { kind, apiVersion } = params

  const queryParams = new URLSearchParams({
    kind,
    apiVersion,
  })

  try {
    const response = await fetch(`${API_PATH}/capabilities?${queryParams}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      console.warn(`Failed to fetch capabilities: ${response.status} ${response.statusText}`)
      return { data: null, error: true }
    }

    const json = await response.json()

    // Check if MCP returned an error in the response body
    if (json.data?.result?.success === false) {
      console.warn('MCP returned error:', json.data?.result?.error)
      return { data: null, error: true }
    }

    // Extract printer columns from MCP response structure
    const printerColumns = json.data?.result?.data?.printerColumns || []
    return {
      data: {
        kind,
        apiVersion,
        printerColumns,
      },
      error: false,
    }
  } catch (err) {
    console.warn('Failed to fetch capabilities:', err)
    return { data: null, error: true }
  }
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
  status?: Record<string, unknown> // Raw K8s status object, varies by resource type
  spec?: Record<string, unknown> // Raw K8s spec object
  // Allow additional fields for full resource data
  [key: string]: unknown
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
  includeStatus?: boolean // Fetch live status from K8s API (slower)
}

/**
 * Fetch resources of a specific kind from the cluster
 * Data comes from Qdrant via MCP server
 * @param includeStatus - When true, fetches live status from K8s API (slower)
 */
export async function getResources(params: GetResourcesParams): Promise<ResourcesResponse> {
  const { kind, apiGroup, apiVersion, namespace, limit = 100, offset = 0, includeStatus } = params

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

  if (includeStatus) {
    queryParams.set('includeStatus', 'true')
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
