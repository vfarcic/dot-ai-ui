import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { CollapsibleTree } from '../components/dashboard/CollapsibleTree'
import { ExpandableDescription } from '../components/dashboard/ExpandableDescription'
import {
  classifyStatus,
  getStatusColorClasses,
  isStatusColumn,
} from '../utils/statusColors'

// Mock capabilities data - will be replaced with real API call
const MOCK_CAPABILITIES = {
  description: 'Pod is the fundamental Kubernetes resource that defines and manages one or more containers running together on a node. It handles container orchestration, resource allocation, health monitoring, and lifecycle management with extensive configuration options for networking, storage, security, and scheduling.',
  useCase: 'Running containerized applications in Kubernetes with granular control over container lifecycle, resource allocation, placement constraints, and operational behavior.',
  printerColumns: [
    { name: 'Name', type: 'string', jsonPath: '.metadata.name' },
    { name: 'Namespace', type: 'string', jsonPath: '.metadata.namespace' },
    { name: 'Status', type: 'string', jsonPath: '.status.phase' },
    { name: 'Pod IP', type: 'string', jsonPath: '.status.podIP' },
    { name: 'Node', type: 'string', jsonPath: '.spec.nodeName' },
    { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp' },
  ],
}

// Mock data for a Pod resource - will be replaced with real API calls
const MOCK_RESOURCE = {
  metadata: {
    name: 'nginx-7d9b8c6f5-abc12',
    namespace: 'default',
    uid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    creationTimestamp: '2025-01-07T10:30:00Z',
    labels: {
      app: 'nginx',
      'pod-template-hash': '7d9b8c6f5',
      environment: 'production',
    },
    annotations: {
      'kubernetes.io/created-by': 'deployment-controller',
      'prometheus.io/scrape': 'true',
      'prometheus.io/port': '9090',
    },
    ownerReferences: [
      {
        apiVersion: 'apps/v1',
        kind: 'ReplicaSet',
        name: 'nginx-7d9b8c6f5',
        uid: 'rs-uid-12345',
        controller: true,
      },
    ],
  },
  spec: {
    containers: [
      {
        name: 'nginx',
        image: 'nginx:1.21',
        ports: [{ containerPort: 80, protocol: 'TCP' }],
        resources: {
          requests: { cpu: '100m', memory: '128Mi' },
          limits: { cpu: '500m', memory: '512Mi' },
        },
        volumeMounts: [
          { name: 'config', mountPath: '/etc/nginx/conf.d', readOnly: true },
        ],
      },
      {
        name: 'sidecar',
        image: 'busybox:latest',
        command: ['sh', '-c', 'while true; do echo hello; sleep 10; done'],
      },
    ],
    volumes: [
      {
        name: 'config',
        configMap: { name: 'nginx-config' },
      },
    ],
    restartPolicy: 'Always',
    serviceAccountName: 'default',
    nodeName: 'worker-node-1',
  },
  status: {
    phase: 'Running',
    conditions: [
      { type: 'Initialized', status: 'True', lastTransitionTime: '2025-01-07T10:30:05Z' },
      { type: 'Ready', status: 'True', lastTransitionTime: '2025-01-07T10:30:15Z' },
      { type: 'ContainersReady', status: 'True', lastTransitionTime: '2025-01-07T10:30:15Z' },
      { type: 'PodScheduled', status: 'True', lastTransitionTime: '2025-01-07T10:30:00Z' },
    ],
    containerStatuses: [
      {
        name: 'nginx',
        state: { running: { startedAt: '2025-01-07T10:30:10Z' } },
        ready: true,
        restartCount: 0,
        image: 'nginx:1.21',
        imageID: 'docker-pullable://nginx@sha256:abc123',
      },
      {
        name: 'sidecar',
        state: { running: { startedAt: '2025-01-07T10:30:12Z' } },
        ready: true,
        restartCount: 2,
        image: 'busybox:latest',
        imageID: 'docker-pullable://busybox@sha256:def456',
      },
    ],
    hostIP: '192.168.1.10',
    podIP: '10.244.0.15',
    startTime: '2025-01-07T10:30:00Z',
  },
}

type TabId = 'overview' | 'metadata' | 'spec' | 'status' | 'yaml' | 'events' | 'logs'

interface Tab {
  id: TabId
  label: string
  disabled?: boolean
}

const TABS: Tab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'metadata', label: 'Metadata' },
  { id: 'spec', label: 'Spec' },
  { id: 'status', label: 'Status' },
  { id: 'yaml', label: 'YAML', disabled: true },
  { id: 'events', label: 'Events', disabled: true },
  { id: 'logs', label: 'Logs', disabled: true },
]

// ============================================================================
// JSONPath Value Extraction (same as ResourceList)
// ============================================================================

function extractJsonPathValue(obj: unknown, jsonPath: string): unknown {
  if (!jsonPath || !obj) return undefined

  const path = jsonPath.startsWith('.') ? jsonPath.slice(1) : jsonPath
  const parts = path.split(/\.(?![^\[]*\])/)

  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined

    const arrayMatch = part.match(/^([^[]+)\[(\d+|\*)\]$/)
    if (arrayMatch) {
      const [, key, indexStr] = arrayMatch
      const record = current as Record<string, unknown>
      const arr = record[key]
      if (!Array.isArray(arr)) return undefined

      if (indexStr === '*') {
        return arr.map((item) =>
          typeof item === 'object' && item !== null ? JSON.stringify(item) : String(item ?? '')
        ).join(', ')
      }
      current = arr[parseInt(indexStr, 10)]
    } else {
      const record = current as Record<string, unknown>
      current = record[part]
    }
  }

  return current
}

function formatAge(timestamp: string): string {
  const created = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - created.getTime()

  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return `${seconds}s`
}

function formatColumnValue(value: unknown, columnType: string): string {
  if (value === null || value === undefined) return '-'

  if (columnType === 'date') {
    const date = new Date(String(value))
    if (isNaN(date.getTime())) return String(value)
    return formatAge(String(value))
  }

  if (columnType === 'integer' || columnType === 'number') {
    return String(value)
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

// ============================================================================
// Components
// ============================================================================

interface PrinterColumn {
  name: string
  type: string
  jsonPath: string
}

interface OverviewCardProps {
  column: PrinterColumn
  value: string
}

function OverviewCard({ column, value }: OverviewCardProps) {
  const shouldColorStatus = isStatusColumn(column.name, column.jsonPath)
  const statusClass = shouldColorStatus
    ? getStatusColorClasses(classifyStatus(value))
    : 'text-foreground'

  return (
    <div className="flex flex-col p-4 bg-muted/30 rounded-lg border border-border min-w-[150px]">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
        {column.name}
      </span>
      <span className={`text-sm font-medium ${statusClass} break-all`}>
        {value || '-'}
      </span>
    </div>
  )
}

export function ResourceDetail() {
  const { group, version, kind, namespace, name } = useParams()
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  // Build back link preserving current filters
  const backParams = new URLSearchParams()
  if (namespace && namespace !== '_cluster') {
    backParams.set('ns', namespace)
  }
  if (kind) backParams.set('kind', kind)
  if (version) backParams.set('version', version)
  if (group && group !== '_core') backParams.set('group', group)
  const backLink = `/dashboard?${backParams.toString()}`

  // For now, use mock data - will be replaced with API call
  const resource = MOCK_RESOURCE
  const capabilities = MOCK_CAPABILITIES

  // Build full resource object for JSONPath extraction
  const fullResource = {
    metadata: resource.metadata,
    spec: resource.spec,
    status: resource.status,
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-header-bg border-b border-border px-4 py-2 flex items-center gap-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <img
            src="/logo.jpeg"
            alt="DevOps AI Toolkit"
            className="h-8 w-auto rounded"
          />
          <span className="text-sm font-medium text-primary">
            DevOps AI Toolkit
          </span>
        </Link>
        <span className="text-border">|</span>
        <span className="text-sm font-medium text-foreground">Dashboard</span>
      </header>

      {/* Resource header */}
      <div className="border-b border-border px-6 py-4">
        {/* Back link */}
        <Link
          to={backLink}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-3"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to {kind}
        </Link>

        {/* Resource name and kind */}
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-xl font-semibold text-foreground">{name}</h1>
          <span className="text-sm text-muted-foreground px-2 py-0.5 bg-muted/50 rounded">
            {kind}
            {group && group !== '_core' && `.${group}`}
          </span>
        </div>

        {/* Resource description from capabilities */}
        <div className="mb-4">
          <ExpandableDescription
            description={capabilities.description}
            useCase={capabilities.useCase}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border px-6">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : tab.disabled
                    ? 'border-transparent text-muted-foreground/50 cursor-not-allowed'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <main className="flex-1 p-6 overflow-auto">
        {activeTab === 'overview' && (
          <div className="max-w-5xl">
            <div className="flex flex-wrap gap-4">
              {capabilities.printerColumns.map((column) => {
                const rawValue = extractJsonPathValue(fullResource, column.jsonPath)
                const displayValue = formatColumnValue(rawValue, column.type)
                return (
                  <OverviewCard
                    key={column.name}
                    column={column}
                    value={displayValue}
                  />
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'metadata' && (
          <div className="max-w-5xl">
            <div className="p-4 bg-muted/30 rounded-lg border border-border">
              <CollapsibleTree data={resource.metadata} initialExpandLevel={2} />
            </div>
          </div>
        )}

        {activeTab === 'spec' && (
          <div className="max-w-5xl">
            <div className="p-4 bg-muted/30 rounded-lg border border-border">
              <CollapsibleTree data={resource.spec} initialExpandLevel={2} />
            </div>
          </div>
        )}

        {activeTab === 'status' && (
          <div className="max-w-5xl">
            <div className="p-4 bg-muted/30 rounded-lg border border-border">
              <CollapsibleTree data={resource.status} initialExpandLevel={2} />
            </div>
          </div>
        )}

        {activeTab === 'yaml' && (
          <div className="text-muted-foreground">YAML tab coming soon...</div>
        )}

        {activeTab === 'events' && (
          <div className="text-muted-foreground">Events tab coming soon...</div>
        )}

        {activeTab === 'logs' && (
          <div className="text-muted-foreground">Logs tab coming soon...</div>
        )}
      </main>
    </div>
  )
}
