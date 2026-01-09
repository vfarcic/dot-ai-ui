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
    // spec/status fields - only shown on detail page
    { name: 'IP', type: 'string', jsonPath: '.status.podIP', priority: 1 },
    { name: 'Node', type: 'string', jsonPath: '.spec.nodeName', priority: 1 },
    { name: 'Host IP', type: 'string', jsonPath: '.status.hostIP', priority: 1 },
    { name: 'Service Account', type: 'string', jsonPath: '.spec.serviceAccountName', priority: 1 },
    { name: 'Restart Policy', type: 'string', jsonPath: '.spec.restartPolicy', priority: 1 },
  ],
  'Service/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // spec fields - only shown on detail page
    { name: 'Type', type: 'string', jsonPath: '.spec.type', priority: 1 },
    { name: 'Cluster IP', type: 'string', jsonPath: '.spec.clusterIP', priority: 1 },
    { name: 'Session Affinity', type: 'string', jsonPath: '.spec.sessionAffinity', priority: 1 },
  ],
  'ConfigMap/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // Excluded: Data - need data field count
  ],
  'Secret/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // spec fields - only shown on detail page
    { name: 'Type', type: 'string', jsonPath: '.type', priority: 1 },
  ],
  'Node/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Version', type: 'string', jsonPath: '.status.nodeInfo.kubeletVersion', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // status fields - only shown on detail page
    { name: 'OS Image', type: 'string', jsonPath: '.status.nodeInfo.osImage', priority: 1 },
    { name: 'Kernel', type: 'string', jsonPath: '.status.nodeInfo.kernelVersion', priority: 1 },
    { name: 'Container Runtime', type: 'string', jsonPath: '.status.nodeInfo.containerRuntimeVersion', priority: 1 },
    { name: 'Architecture', type: 'string', jsonPath: '.status.nodeInfo.architecture', priority: 1 },
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
    // spec fields - only shown on detail page
    { name: 'Replicas', type: 'integer', jsonPath: '.spec.replicas', priority: 1 },
    { name: 'Strategy', type: 'string', jsonPath: '.spec.strategy.type', priority: 1 },
    { name: 'Revision History', type: 'integer', jsonPath: '.spec.revisionHistoryLimit', priority: 1 },
  ],
  'DaemonSet/apps/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Desired', type: 'integer', jsonPath: '.status.desiredNumberScheduled', priority: 0 },
    { name: 'Current', type: 'integer', jsonPath: '.status.currentNumberScheduled', priority: 0 },
    { name: 'Ready', type: 'integer', jsonPath: '.status.numberReady', priority: 0 },
    { name: 'Up-to-date', type: 'integer', jsonPath: '.status.updatedNumberScheduled', priority: 0 },
    { name: 'Available', type: 'integer', jsonPath: '.status.numberAvailable', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // spec fields - only shown on detail page
    { name: 'Update Strategy', type: 'string', jsonPath: '.spec.updateStrategy.type', priority: 1 },
  ],
  'ReplicaSet/apps/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Desired', type: 'integer', jsonPath: '.status.replicas', priority: 0 },
    { name: 'Current', type: 'integer', jsonPath: '.status.fullyLabeledReplicas', priority: 0 },
    { name: 'Ready', type: 'integer', jsonPath: '.status.readyReplicas', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // spec fields - only shown on detail page
    { name: 'Replicas', type: 'integer', jsonPath: '.spec.replicas', priority: 1 },
  ],
  'StatefulSet/apps/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Ready', type: 'integer', jsonPath: '.status.readyReplicas', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // spec fields - only shown on detail page
    { name: 'Replicas', type: 'integer', jsonPath: '.spec.replicas', priority: 1 },
    { name: 'Service Name', type: 'string', jsonPath: '.spec.serviceName', priority: 1 },
    { name: 'Pod Management', type: 'string', jsonPath: '.spec.podManagementPolicy', priority: 1 },
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
    // spec fields - only shown on detail page
    { name: 'Completions', type: 'integer', jsonPath: '.spec.completions', priority: 1 },
    { name: 'Parallelism', type: 'integer', jsonPath: '.spec.parallelism', priority: 1 },
    { name: 'Backoff Limit', type: 'integer', jsonPath: '.spec.backoffLimit', priority: 1 },
    { name: 'Active Deadline', type: 'integer', jsonPath: '.spec.activeDeadlineSeconds', priority: 1 },
  ],
  'CronJob/batch/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Active', type: 'integer', jsonPath: '.status.active', priority: 0 },
    { name: 'Last Schedule', type: 'date', jsonPath: '.status.lastScheduleTime', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // spec fields - only shown on detail page
    { name: 'Schedule', type: 'string', jsonPath: '.spec.schedule', priority: 1 },
    { name: 'Suspend', type: 'boolean', jsonPath: '.spec.suspend', priority: 1 },
    { name: 'Concurrency', type: 'string', jsonPath: '.spec.concurrencyPolicy', priority: 1 },
    { name: 'History Limit', type: 'integer', jsonPath: '.spec.successfulJobsHistoryLimit', priority: 1 },
  ],

  // ============================================================================
  // networking.k8s.io/v1 Resources (apiVersion: networking.k8s.io/v1)
  // ============================================================================
  'Ingress/networking.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // spec fields - only shown on detail page
    { name: 'Class', type: 'string', jsonPath: '.spec.ingressClassName', priority: 1 },
  ],
  'IngressClass/networking.k8s.io/v1': [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name', priority: 0 },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp', priority: 0 },
    // spec fields - only shown on detail page
    { name: 'Controller', type: 'string', jsonPath: '.spec.controller', priority: 1 },
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

export interface GetBuiltinColumnsOptions {
  /**
   * Include columns that require spec data (priority > 0)
   * - false (default): Only return columns usable in list view (metadata/status only)
   * - true: Return all columns including spec fields (for detail view)
   */
  includeSpec?: boolean
}

/**
 * Get printer columns for a built-in Kubernetes resource
 * Returns hardcoded columns for built-in resources, or null to fetch from MCP (for CRDs)
 *
 * @param kind - Resource kind (e.g., "Pod", "Deployment")
 * @param apiVersion - API version (e.g., "v1", "apps/v1")
 * @param options - Options for filtering columns
 * @returns Filtered columns array, or null if not a built-in resource
 */
export function getBuiltinResourceColumns(
  kind: string,
  apiVersion: string,
  options?: GetBuiltinColumnsOptions
): PrinterColumn[] | null {
  const key = `${kind}/${apiVersion}`
  const columns = BUILTIN_RESOURCE_COLUMNS[key]

  if (!columns) return null

  // If includeSpec is true, return all columns (for detail view)
  if (options?.includeSpec) {
    return columns
  }

  // Otherwise, filter out columns that need spec data (priority > 0)
  return columns.filter(col => col.priority === 0)
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

// ============================================================================
// Single Resource API
// ============================================================================

export interface KubernetesResource {
  apiVersion: string
  kind: string
  metadata: {
    name: string
    namespace?: string
    uid?: string
    creationTimestamp?: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
    ownerReferences?: Array<{
      apiVersion: string
      kind: string
      name: string
      uid: string
      controller?: boolean
    }>
    [key: string]: unknown
  }
  spec?: Record<string, unknown>
  status?: Record<string, unknown>
  [key: string]: unknown
}

export interface GetResourceParams {
  kind: string
  apiVersion: string
  name: string
  namespace?: string
}

export interface GetResourceResult {
  resource: KubernetesResource | null
  error: string | null
}

/**
 * Fetch a single Kubernetes resource by name
 * Returns full resource data including metadata, spec, and status
 */
export async function getResource(params: GetResourceParams): Promise<GetResourceResult> {
  const { kind, apiVersion, name, namespace } = params

  const queryParams = new URLSearchParams({ kind, apiVersion, name })
  if (namespace) {
    queryParams.set('namespace', namespace)
  }

  try {
    const response = await fetch(`${API_PATH}/resource?${queryParams}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return { resource: null, error: 'Resource not found' }
      }
      return { resource: null, error: `Failed to fetch resource: ${response.status} ${response.statusText}` }
    }

    const json = await response.json()
    const resource = json.data?.resource || null

    return { resource, error: null }
  } catch (err) {
    console.error('Failed to fetch resource:', err)
    return { resource: null, error: 'Failed to connect to server' }
  }
}
