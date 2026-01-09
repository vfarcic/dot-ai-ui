import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { CollapsibleTree } from '../components/dashboard/CollapsibleTree'
import { ExpandableDescription } from '../components/dashboard/ExpandableDescription'
import {
  classifyStatus,
  getStatusColorClasses,
  isStatusColumn,
} from '../utils/statusColors'
import {
  getCapabilities,
  getBuiltinResourceColumns,
  getResource,
  DEFAULT_COLUMNS,
  type ResourceCapabilities,
  type KubernetesResource,
} from '../api/dashboard'

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
  { id: 'yaml', label: 'YAML' },
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
  const [capabilities, setCapabilities] = useState<ResourceCapabilities | null>(null)
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(true)
  const [resource, setResource] = useState<KubernetesResource | null>(null)
  const [resourceLoading, setResourceLoading] = useState(true)
  const [resourceError, setResourceError] = useState<string | null>(null)

  // Fetch capabilities when component mounts or resource type changes
  useEffect(() => {
    if (!kind || !version) {
      setCapabilitiesLoading(false)
      return
    }

    const fetchCaps = async () => {
      setCapabilitiesLoading(true)

      // Build apiVersion: handle both "v1" and "apps/v1" formats
      const apiVersion = group && group !== '_core'
        ? `${group}/${version}`
        : version

      // Check for hardcoded built-in resource columns first
      // On detail page, include all columns (includeSpec: true) since we have full resource data
      const builtinColumns = getBuiltinResourceColumns(kind, apiVersion, { includeSpec: true })

      if (builtinColumns) {
        // For built-in resources, fetch from MCP for description/useCase but use hardcoded columns
        const result = await getCapabilities({ kind, apiVersion })
        setCapabilities({
          kind,
          apiVersion,
          printerColumns: builtinColumns,
          description: result.data?.description,
          useCase: result.data?.useCase,
        })
      } else {
        // Fetch from MCP for CRDs and other resources
        const result = await getCapabilities({ kind, apiVersion })
        if (result.error || !result.data) {
          setCapabilities({
            kind,
            apiVersion,
            printerColumns: DEFAULT_COLUMNS,
          })
        } else {
          // On detail page, include all columns (including .spec) since we have full resource data
          // Only filter out columns with empty jsonPath
          const validColumns = (result.data.printerColumns || []).filter((col) => {
            if (!col.jsonPath || col.jsonPath.trim() === '') return false
            return true
          })
          setCapabilities({
            ...result.data,
            printerColumns: validColumns.length > 0 ? validColumns : DEFAULT_COLUMNS,
          })
        }
      }
      setCapabilitiesLoading(false)
    }

    fetchCaps()
  }, [kind, version, group])

  // Fetch resource data when component mounts or resource changes
  useEffect(() => {
    if (!kind || !version || !name) {
      setResourceLoading(false)
      setResourceError('Missing required resource parameters')
      return
    }

    const fetchResourceData = async () => {
      setResourceLoading(true)
      setResourceError(null)

      // Build apiVersion: handle both "v1" and "apps/v1" formats
      const apiVersion = group && group !== '_core'
        ? `${group}/${version}`
        : version

      // For cluster-scoped resources, namespace is '_cluster' in URL
      const ns = namespace === '_cluster' ? undefined : namespace

      const result = await getResource({
        kind,
        apiVersion,
        name,
        namespace: ns,
      })

      if (result.error) {
        setResourceError(result.error)
        setResource(null)
      } else {
        setResource(result.resource)
      }
      setResourceLoading(false)
    }

    fetchResourceData()
  }, [kind, version, group, namespace, name])

  // Build back link preserving current filters
  const backParams = new URLSearchParams()
  if (namespace && namespace !== '_cluster') {
    backParams.set('ns', namespace)
  }
  if (kind) backParams.set('kind', kind)
  if (version) backParams.set('version', version)
  if (group && group !== '_core') backParams.set('group', group)
  const backLink = `/dashboard?${backParams.toString()}`

  // Build full resource object for JSONPath extraction
  const fullResource = resource ? {
    metadata: resource.metadata,
    spec: resource.spec,
    status: resource.status,
  } : null

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
            description={capabilities?.description}
            useCase={capabilities?.useCase}
            loading={capabilitiesLoading}
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
        {resourceLoading ? (
          <div className="text-muted-foreground">Loading resource...</div>
        ) : resourceError ? (
          <div className="text-red-500">{resourceError}</div>
        ) : !resource ? (
          <div className="text-muted-foreground">No resource data available</div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className="max-w-5xl">
                {capabilitiesLoading ? (
                  <div className="text-muted-foreground">Loading...</div>
                ) : (
                  <div className="flex flex-wrap gap-4">
                    {(capabilities?.printerColumns || DEFAULT_COLUMNS).map((column) => {
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
                )}
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
                  <CollapsibleTree data={resource.spec || {}} initialExpandLevel={2} />
                </div>
              </div>
            )}

            {activeTab === 'status' && (
              <div className="max-w-5xl">
                <div className="p-4 bg-muted/30 rounded-lg border border-border">
                  <CollapsibleTree data={resource.status || {}} initialExpandLevel={2} />
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
          </>
        )}
      </main>
    </div>
  )
}
