// Mock Kubernetes data for dashboard prototyping
// This file contains hard-coded data that will be replaced by real MCP/K8s API calls.
// Search for "MOCK:" comments to find all mocked data points.

// MOCK: Replace with MCP `listNamespaces` endpoint
// Expected response: { namespaces: ["default", "kube-system", ...] }
export const namespaces = [
  'default',
  'kube-system',
  'production',
  'staging',
  'monitoring',
]

export type ResourceStatus =
  | 'Running'
  | 'Pending'
  | 'Succeeded'
  | 'Failed'
  | 'CrashLoopBackOff'
  | 'ImagePullBackOff'
  | 'Terminating'
  | 'Unknown'
  | 'Active'
  | 'Bound'
  | 'Synced'
  | 'OutOfSync'
  | 'Healthy'
  | 'Degraded'

export interface ResourceGroup {
  name: string
  kinds: string[]
}

// MOCK: Replace with MCP `listResourceKinds` endpoint
// Expected response: { kinds: [{ kind, apiGroup, apiVersion, count }] }
// Then group by category (Workloads, Network, Config, etc.) in the UI
export const resourceGroups: ResourceGroup[] = [
  {
    name: 'Workloads',
    kinds: ['Pods', 'Deployments', 'ReplicaSets', 'StatefulSets', 'DaemonSets', 'Jobs'],
  },
  {
    name: 'Network',
    kinds: ['Services', 'Ingresses', 'NetworkPolicies'],
  },
  {
    name: 'Config',
    kinds: ['ConfigMaps', 'Secrets'],
  },
  {
    name: 'Storage',
    kinds: ['PersistentVolumeClaims'],
  },
  {
    name: 'Custom Resources',
    kinds: ['Applications (argoproj.io)', 'PostgreSQL (cnpg.io)'],
  },
]

export interface K8sResource {
  name: string
  namespace: string
  status: ResourceStatus
  age: string
  labels?: Record<string, string>
  // Pod-specific
  restarts?: number
  ready?: string
  // Deployment-specific
  replicas?: string
  // Service-specific
  type?: string
  clusterIP?: string
  ports?: string
}

// MOCK: Replace with MCP `listResources` endpoint (kind: "Pod")
// Expected response: { resources: [{ name, namespace, kind, labels, createdAt }], total }
// Status fields (ready, status, restarts) come from K8s API status enrichment
export const pods: K8sResource[] = [
  {
    name: 'nginx-7d8b49557c-abc12',
    namespace: 'default',
    status: 'Running',
    ready: '1/1',
    restarts: 0,
    age: '2d',
  },
  {
    name: 'nginx-7d8b49557c-def34',
    namespace: 'default',
    status: 'Running',
    ready: '1/1',
    restarts: 0,
    age: '2d',
  },
  {
    name: 'api-server-5f6d7c8b9-xyz99',
    namespace: 'default',
    status: 'CrashLoopBackOff',
    ready: '0/1',
    restarts: 15,
    age: '1h',
  },
  {
    name: 'postgres-0',
    namespace: 'default',
    status: 'Running',
    ready: '1/1',
    restarts: 0,
    age: '5d',
  },
  {
    name: 'redis-master-0',
    namespace: 'default',
    status: 'Running',
    ready: '1/1',
    restarts: 2,
    age: '3d',
  },
  {
    name: 'worker-batch-job-abc12',
    namespace: 'default',
    status: 'Pending',
    ready: '0/1',
    restarts: 0,
    age: '5m',
  },
  {
    name: 'coredns-5dd5756b68-abc12',
    namespace: 'kube-system',
    status: 'Running',
    ready: '1/1',
    restarts: 0,
    age: '30d',
  },
  {
    name: 'coredns-5dd5756b68-def34',
    namespace: 'kube-system',
    status: 'Running',
    ready: '1/1',
    restarts: 0,
    age: '30d',
  },
  {
    name: 'kube-proxy-abc12',
    namespace: 'kube-system',
    status: 'Running',
    ready: '1/1',
    restarts: 0,
    age: '30d',
  },
  {
    name: 'frontend-v2-abc12',
    namespace: 'production',
    status: 'Running',
    ready: '1/1',
    restarts: 0,
    age: '1d',
  },
  {
    name: 'frontend-v2-def34',
    namespace: 'production',
    status: 'Running',
    ready: '1/1',
    restarts: 0,
    age: '1d',
  },
  {
    name: 'backend-api-abc12',
    namespace: 'production',
    status: 'Running',
    ready: '1/1',
    restarts: 1,
    age: '1d',
  },
  {
    name: 'image-pull-fail-xyz',
    namespace: 'staging',
    status: 'ImagePullBackOff',
    ready: '0/1',
    restarts: 0,
    age: '30m',
  },
  {
    name: 'prometheus-0',
    namespace: 'monitoring',
    status: 'Running',
    ready: '1/1',
    restarts: 0,
    age: '7d',
  },
  {
    name: 'grafana-abc12',
    namespace: 'monitoring',
    status: 'Running',
    ready: '1/1',
    restarts: 0,
    age: '7d',
  },
]

// MOCK: Replace with MCP `listResources` endpoint (kind: "Deployment", apiGroup: "apps")
// Status fields (replicas, status) come from K8s API status enrichment
export const deployments: K8sResource[] = [
  {
    name: 'nginx',
    namespace: 'default',
    status: 'Running',
    replicas: '2/2',
    age: '2d',
  },
  {
    name: 'api-server',
    namespace: 'default',
    status: 'Degraded',
    replicas: '0/1',
    age: '1h',
  },
  {
    name: 'redis-master',
    namespace: 'default',
    status: 'Running',
    replicas: '1/1',
    age: '3d',
  },
  {
    name: 'coredns',
    namespace: 'kube-system',
    status: 'Running',
    replicas: '2/2',
    age: '30d',
  },
  {
    name: 'frontend-v2',
    namespace: 'production',
    status: 'Running',
    replicas: '2/2',
    age: '1d',
  },
  {
    name: 'backend-api',
    namespace: 'production',
    status: 'Running',
    replicas: '1/1',
    age: '1d',
  },
  {
    name: 'prometheus',
    namespace: 'monitoring',
    status: 'Running',
    replicas: '1/1',
    age: '7d',
  },
  {
    name: 'grafana',
    namespace: 'monitoring',
    status: 'Running',
    replicas: '1/1',
    age: '7d',
  },
]

// MOCK: Replace with MCP `listResources` endpoint (kind: "Service")
// Status fields (type, clusterIP, ports) come from K8s API status enrichment
export const services: K8sResource[] = [
  {
    name: 'kubernetes',
    namespace: 'default',
    status: 'Active',
    type: 'ClusterIP',
    clusterIP: '10.96.0.1',
    ports: '443/TCP',
    age: '30d',
  },
  {
    name: 'nginx',
    namespace: 'default',
    status: 'Active',
    type: 'LoadBalancer',
    clusterIP: '10.96.45.12',
    ports: '80/TCP',
    age: '2d',
  },
  {
    name: 'api-server',
    namespace: 'default',
    status: 'Active',
    type: 'ClusterIP',
    clusterIP: '10.96.78.34',
    ports: '8080/TCP',
    age: '1h',
  },
  {
    name: 'postgres',
    namespace: 'default',
    status: 'Active',
    type: 'ClusterIP',
    clusterIP: '10.96.100.5',
    ports: '5432/TCP',
    age: '5d',
  },
  {
    name: 'frontend',
    namespace: 'production',
    status: 'Active',
    type: 'LoadBalancer',
    clusterIP: '10.96.200.10',
    ports: '80/TCP, 443/TCP',
    age: '1d',
  },
  {
    name: 'kube-dns',
    namespace: 'kube-system',
    status: 'Active',
    type: 'ClusterIP',
    clusterIP: '10.96.0.10',
    ports: '53/UDP, 53/TCP',
    age: '30d',
  },
]

// MOCK: Replace with MCP `listResources` endpoint (kind: "ConfigMap")
export const configMaps: K8sResource[] = [
  {
    name: 'nginx-config',
    namespace: 'default',
    status: 'Active',
    age: '2d',
  },
  {
    name: 'api-config',
    namespace: 'default',
    status: 'Active',
    age: '1d',
  },
  {
    name: 'coredns',
    namespace: 'kube-system',
    status: 'Active',
    age: '30d',
  },
  {
    name: 'app-settings',
    namespace: 'production',
    status: 'Active',
    age: '1d',
  },
]

// MOCK: Replace with MCP `listResources` endpoint (kind: "Application", apiGroup: "argoproj.io")
// Status fields (sync status) come from K8s API status enrichment
export const argoApplications: K8sResource[] = [
  {
    name: 'frontend',
    namespace: 'default',
    status: 'Synced',
    age: '7d',
  },
  {
    name: 'backend-api',
    namespace: 'default',
    status: 'OutOfSync',
    age: '3d',
  },
  {
    name: 'monitoring-stack',
    namespace: 'default',
    status: 'Synced',
    age: '14d',
  },
  {
    name: 'database',
    namespace: 'default',
    status: 'Degraded',
    age: '5d',
  },
]

// MOCK: Replace with MCP `listResources` API call
// This function should become an async API call to MCP with filtering
export function getResources(kind: string, namespace?: string): K8sResource[] {
  let resources: K8sResource[] = []

  switch (kind) {
    case 'Pods':
      resources = pods
      break
    case 'Deployments':
      resources = deployments
      break
    case 'Services':
      resources = services
      break
    case 'ConfigMaps':
      resources = configMaps
      break
    case 'Applications (argoproj.io)':
      resources = argoApplications
      break
    default:
      resources = []
  }

  if (namespace && namespace !== 'All Namespaces') {
    return resources.filter((r) => r.namespace === namespace)
  }

  return resources
}

// MOCK: Column definitions - may need to be dynamic based on resource schema
// Consider fetching column metadata from MCP or deriving from resource fields
export function getColumnsForKind(kind: string): string[] {
  switch (kind) {
    case 'Pods':
      return ['Name', 'Namespace', 'Ready', 'Status', 'Restarts', 'Age']
    case 'Deployments':
      return ['Name', 'Namespace', 'Replicas', 'Status', 'Age']
    case 'Services':
      return ['Name', 'Namespace', 'Type', 'Cluster IP', 'Ports', 'Age']
    case 'ConfigMaps':
    case 'Secrets':
      return ['Name', 'Namespace', 'Age']
    case 'Applications (argoproj.io)':
      return ['Name', 'Namespace', 'Sync Status', 'Age']
    default:
      return ['Name', 'Namespace', 'Status', 'Age']
  }
}
