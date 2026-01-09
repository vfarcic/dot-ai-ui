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
 * Printer columns for built-in Kubernetes resources
 * MCP returns column names but empty jsonPaths for built-in resources
 * This provides the correct jsonPaths matching what kubectl uses
 *
 * IMPORTANT: Only includes columns that use data MCP returns:
 * - .metadata.* fields (name, namespace, creationTimestamp, labels)
 * - .status.* fields (when includeStatus=true)
 * - NOT .spec.* fields (MCP doesn't return spec data)
 */
export const BUILTIN_RESOURCE_COLUMNS: Record<string, PrinterColumn[]> = {
  // ============================================================================
  // Core (v1) Resources
  // ============================================================================
  'Pod/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Status', type: 'string', jsonPath: '.status.phase', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Ready, Restarts, IP, Node - need status.containerStatuses computation or spec
  ],
  'Service/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Type, Cluster-IP, External-IP, Ports - need spec
  ],
  'ConfigMap/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Data - need data field count
  ],
  'Secret/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Type, Data - need type and data field count
  ],
  'Node/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Version', type: 'string', jsonPath: '.status.nodeInfo.kubeletVersion', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Status, Roles, Internal-IP - need status.conditions computation
  ],
  'Namespace/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Status', type: 'string', jsonPath: '.status.phase', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
  ],
  'ServiceAccount/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Secrets - need secrets array length
  ],
  'Endpoints/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Endpoints - need subsets computation
  ],
  'PersistentVolume/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Status', type: 'string', jsonPath: '.status.phase', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Capacity, Access Modes, Reclaim Policy, StorageClass - need spec
  ],
  'PersistentVolumeClaim/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Status', type: 'string', jsonPath: '.status.phase', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Volume, Capacity, Access Modes, StorageClass - need spec
  ],
  'Event/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Type, Reason, Object, Message - need specific event fields
  ],
  'LimitRange/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
  ],
  'ResourceQuota/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Request, Limit - need status.hard/used computation
  ],

  // ============================================================================
  // apps/v1 Resources (apiVersion: apps/v1)
  // ============================================================================
  'Deployment/apps/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Ready', type: 'integer', jsonPath: '.status.readyReplicas', priority: 0 },
    { name: 'Up-to-date', type: 'integer', jsonPath: '.status.updatedReplicas', priority: 0 },
    { name: 'Available', type: 'integer', jsonPath: '.status.availableReplicas', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Containers, Images, Selector - need spec
  ],
  'DaemonSet/apps/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Desired', type: 'integer', jsonPath: '.status.desiredNumberScheduled', priority: 0 },
    { name: 'Current', type: 'integer', jsonPath: '.status.currentNumberScheduled', priority: 0 },
    { name: 'Ready', type: 'integer', jsonPath: '.status.numberReady', priority: 0 },
    { name: 'Up-to-date', type: 'integer', jsonPath: '.status.updatedNumberScheduled', priority: 0 },
    { name: 'Available', type: 'integer', jsonPath: '.status.numberAvailable', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Node Selector, Containers, Images, Selector - need spec
  ],
  'ReplicaSet/apps/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Desired', type: 'integer', jsonPath: '.status.replicas', priority: 0 },
    { name: 'Current', type: 'integer', jsonPath: '.status.fullyLabeledReplicas', priority: 0 },
    { name: 'Ready', type: 'integer', jsonPath: '.status.readyReplicas', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Containers, Images, Selector - need spec
  ],
  'StatefulSet/apps/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Ready', type: 'integer', jsonPath: '.status.readyReplicas', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Containers, Images - need spec
  ],
  'ControllerRevision/apps/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Revision', type: 'integer', jsonPath: '.revision', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
  ],

  // ============================================================================
  // batch/v1 Resources (apiVersion: batch/v1)
  // ============================================================================
  'Job/batch/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Status', type: 'string', jsonPath: '.status.succeeded', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Completions, Duration, Containers, Images, Selector - need spec or computation
  ],
  'CronJob/batch/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Active', type: 'integer', jsonPath: '.status.active', priority: 0 },
    { name: 'Last Schedule', type: 'date', jsonPath: '.status.lastScheduleTime', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Schedule, Suspend, Timezone, Containers, Images, Selector - need spec
  ],

  // ============================================================================
  // networking.k8s.io/v1 Resources (apiVersion: networking.k8s.io/v1)
  // ============================================================================
  'Ingress/networking.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Class, Hosts, Address, Ports - need spec
  ],
  'IngressClass/networking.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Controller, Parameters - need spec
  ],
  'NetworkPolicy/networking.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Pod-Selector - need spec
  ],
  'IPAddress/networking.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: ParentRef - need spec
  ],
  'ServiceCIDR/networking.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: CIDRs - need spec
  ],

  // ============================================================================
  // rbac.authorization.k8s.io/v1 Resources (apiVersion: rbac.authorization.k8s.io/v1)
  // ============================================================================
  'Role/rbac.authorization.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
  ],
  'ClusterRole/rbac.authorization.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
  ],
  'RoleBinding/rbac.authorization.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Role, Users, Groups, ServiceAccounts - need roleRef and subjects
  ],
  'ClusterRoleBinding/rbac.authorization.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Role, Users, Groups, ServiceAccounts - need roleRef and subjects
  ],

  // ============================================================================
  // admissionregistration.k8s.io/v1 Resources (apiVersion: admissionregistration.k8s.io/v1)
  // ============================================================================
  'MutatingWebhookConfiguration/admissionregistration.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Webhooks - need webhooks array length
  ],
  'ValidatingWebhookConfiguration/admissionregistration.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Webhooks - need webhooks array length
  ],
  'ValidatingAdmissionPolicy/admissionregistration.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
  ],
  'ValidatingAdmissionPolicyBinding/admissionregistration.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
  ],

  // ============================================================================
  // apiextensions.k8s.io/v1 Resources (apiVersion: apiextensions.k8s.io/v1)
  // ============================================================================
  'CustomResourceDefinition/apiextensions.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Created At - redundant with Age
  ],

  // ============================================================================
  // apiregistration.k8s.io/v1 Resources (apiVersion: apiregistration.k8s.io/v1)
  // ============================================================================
  'APIService/apiregistration.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Service, Available - need spec and status.conditions
  ],

  // ============================================================================
  // autoscaling/v2 Resources (apiVersion: autoscaling/v2)
  // ============================================================================
  'HorizontalPodAutoscaler/autoscaling/v2': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Replicas', type: 'integer', jsonPath: '.status.currentReplicas', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Reference, Targets, MinPods, MaxPods - need spec
  ],

  // ============================================================================
  // policy/v1 Resources (apiVersion: policy/v1)
  // ============================================================================
  'PodDisruptionBudget/policy/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Allowed Disruptions', type: 'integer', jsonPath: '.status.disruptionsAllowed', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Min Available, Max Unavailable - need spec
  ],

  // ============================================================================
  // coordination.k8s.io/v1 Resources (apiVersion: coordination.k8s.io/v1)
  // ============================================================================
  'Lease/coordination.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Holder - needs spec.holderIdentity which MCP doesn't return
  ],

  // ============================================================================
  // discovery.k8s.io/v1 Resources (apiVersion: discovery.k8s.io/v1)
  // ============================================================================
  'EndpointSlice/discovery.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: AddressType, Ports, Endpoints - need addressType and arrays
  ],

  // ============================================================================
  // events.k8s.io/v1 Resources (apiVersion: events.k8s.io/v1)
  // ============================================================================
  'Event/events.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
  ],

  // ============================================================================
  // flowcontrol.apiserver.k8s.io/v1 Resources (apiVersion: flowcontrol.apiserver.k8s.io/v1)
  // ============================================================================
  'FlowSchema/flowcontrol.apiserver.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: PriorityLevel, MatchingPrecedence, DistinguisherMethod, MissingPL - need spec
  ],
  'PriorityLevelConfiguration/flowcontrol.apiserver.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Type, NominalConcurrencyShares, Queues, HandSize, QueueLengthLimit - need spec
  ],

  // ============================================================================
  // scheduling.k8s.io/v1 Resources (apiVersion: scheduling.k8s.io/v1)
  // ============================================================================
  'PriorityClass/scheduling.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Value, GlobalDefault - need value and globalDefault fields
  ],

  // ============================================================================
  // storage.k8s.io/v1 Resources (apiVersion: storage.k8s.io/v1)
  // ============================================================================
  'StorageClass/storage.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Provisioner, ReclaimPolicy, VolumeBindingMode - need provisioner field
  ],
  'CSIDriver/storage.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
  ],
  'CSINode/storage.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Drivers - need spec.drivers
  ],
  'CSIStorageCapacity/storage.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
  ],
  'VolumeAttachment/storage.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Attacher, PV, Node - need spec
  ],
  'VolumeAttributesClass/storage.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
  ],

  // ============================================================================
  // node.k8s.io/v1 Resources (apiVersion: node.k8s.io/v1)
  // ============================================================================
  'RuntimeClass/node.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Handler - needs handler field which MCP may not return
  ],

  // ============================================================================
  // certificates.k8s.io/v1 Resources (apiVersion: certificates.k8s.io/v1)
  // ============================================================================
  'CertificateSigningRequest/certificates.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: SignerName, Requestor, RequestedDuration, Condition - need spec and status
  ],

  // ============================================================================
  // resource.k8s.io/v1 Resources (apiVersion: resource.k8s.io/v1)
  // ============================================================================
  'DeviceClass/resource.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
  ],
  'ResourceClaim/resource.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
  ],
  'ResourceClaimTemplate/resource.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
  ],
  'ResourceSlice/resource.k8s.io/v1': [
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
 * Get printer columns for a built-in Kubernetes resource
 * Returns hardcoded columns for built-in resources, or null to fetch from MCP (for CRDs)
 */
export function getBuiltinResourceColumns(kind: string, apiVersion: string): PrinterColumn[] | null {
  const key = `${kind}/${apiVersion}`
  return BUILTIN_RESOURCE_COLUMNS[key] || null
}

export interface ResourceCapabilities {
  kind: string
  apiVersion: string
  printerColumns?: PrinterColumn[]
  description?: string
  useCase?: string
}

export interface GetCapabilitiesParams {
  kind: string
  apiVersion: string
}

export interface GetCapabilitiesResult {
  data: ResourceCapabilities | null
  error: boolean
}

// In-memory cache for capabilities (keyed by "kind/apiVersion")
const capabilitiesCache = new Map<string, GetCapabilitiesResult>()

/**
 * Get cache key for capabilities
 */
function getCapabilitiesCacheKey(kind: string, apiVersion: string): string {
  return `${kind}/${apiVersion}`
}

/**
 * Fetch capabilities for a resource kind
 * Returns printer columns if available (from CRD additionalPrinterColumns or K8s Table API)
 * Returns { data, error } to distinguish between API errors and empty results
 * Results are cached in memory to avoid redundant fetches (e.g., list → detail navigation)
 */
export async function getCapabilities(params: GetCapabilitiesParams): Promise<GetCapabilitiesResult> {
  const { kind, apiVersion } = params
  const cacheKey = getCapabilitiesCacheKey(kind, apiVersion)

  // Check cache first
  const cached = capabilitiesCache.get(cacheKey)
  if (cached) {
    return cached
  }

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

    // Extract data from MCP response structure
    const mcpData = json.data?.result?.data
    const printerColumns = mcpData?.printerColumns || []
    const description = mcpData?.description || undefined
    const useCase = mcpData?.useCase || undefined

    const result: GetCapabilitiesResult = {
      data: {
        kind,
        apiVersion,
        printerColumns,
        description,
        useCase,
      },
      error: false,
    }

    // Cache successful results
    capabilitiesCache.set(cacheKey, result)
    return result
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
