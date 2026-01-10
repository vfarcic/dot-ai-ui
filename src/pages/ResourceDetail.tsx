import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { stringify as yamlStringify } from 'yaml'
import Prism from 'prismjs'
import 'prismjs/components/prism-yaml'
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
  getResourceEvents,
  getPodLogs,
  DEFAULT_COLUMNS,
  type ResourceCapabilities,
  type KubernetesResource,
  type KubernetesEvent,
  type GetPodLogsResult,
} from '../api/dashboard'

type TabId = 'overview' | 'metadata' | 'spec' | 'status' | 'yaml' | 'events' | 'logs'

interface Tab {
  id: TabId
  label: string
  disabled?: boolean
}

const BASE_TABS: Tab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'metadata', label: 'Metadata' },
  { id: 'spec', label: 'Spec' },
  { id: 'status', label: 'Status' },
  { id: 'yaml', label: 'YAML' },
  { id: 'events', label: 'Events' },
]

const LOGS_TAB: Tab = { id: 'logs', label: 'Logs' }

/**
 * Get tabs for a resource kind
 * Logs tab only appears for Pod resources
 */
function getTabsForKind(kind: string | undefined): Tab[] {
  if (kind === 'Pod') {
    return [...BASE_TABS, LOGS_TAB]
  }
  return BASE_TABS
}

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
// YAML Conversion
// ============================================================================

/**
 * Convert a Kubernetes resource to YAML with canonical field ordering
 * Order: apiVersion, kind, metadata, spec, status (matching kubectl output)
 */
function resourceToYaml(resource: KubernetesResource): string {
  // Build object with explicit field ordering
  const ordered: Record<string, unknown> = {
    apiVersion: resource.apiVersion,
    kind: resource.kind,
    metadata: resource.metadata,
  }

  // Only include spec/status if they exist
  if (resource.spec !== undefined) {
    ordered.spec = resource.spec
  }
  if (resource.status !== undefined) {
    ordered.status = resource.status
  }

  return yamlStringify(ordered, {
    indent: 2,
    lineWidth: 0, // Don't wrap lines
    nullStr: 'null',
  })
}

// ============================================================================
// Components
// ============================================================================

interface YamlViewProps {
  yaml: string
}

function YamlView({ yaml }: YamlViewProps) {
  const codeRef = useRef<HTMLElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current)
    }
  }, [yaml])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(yaml)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="relative group max-w-5xl">
      <div className="absolute top-3 right-3 z-10">
        <button
          onClick={handleCopy}
          className="text-xs text-muted-foreground bg-muted hover:bg-muted/80 px-3 py-1.5 rounded transition-colors"
          title="Copy to clipboard"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="rounded-lg bg-[#1a1a1a] p-4 overflow-auto text-sm !m-0 max-h-[70vh]">
        <code ref={codeRef} className="language-yaml">
          {yaml}
        </code>
      </pre>
    </div>
  )
}

interface EventsViewProps {
  events: KubernetesEvent[]
  loading: boolean
  error: string | null
}

function EventsView({ events, loading, error }: EventsViewProps) {
  if (loading) {
    return <div className="text-muted-foreground">Loading events...</div>
  }

  if (error) {
    return <div className="text-red-500">{error}</div>
  }

  if (events.length === 0) {
    return (
      <div className="text-muted-foreground text-center py-8">
        No events found for this resource
      </div>
    )
  }

  // Sort events by lastTimestamp (most recent first)
  const sortedEvents = [...events].sort((a, b) => {
    const timeA = a.lastTimestamp || a.firstTimestamp || ''
    const timeB = b.lastTimestamp || b.firstTimestamp || ''
    return new Date(timeB).getTime() - new Date(timeA).getTime()
  })

  return (
    <div className="max-w-6xl">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="py-2 pr-4 font-medium text-muted-foreground w-20">Type</th>
            <th className="py-2 pr-4 font-medium text-muted-foreground w-32">Reason</th>
            <th className="py-2 pr-4 font-medium text-muted-foreground w-24">Age</th>
            <th className="py-2 pr-4 font-medium text-muted-foreground w-32">Source</th>
            <th className="py-2 font-medium text-muted-foreground">Message</th>
          </tr>
        </thead>
        <tbody>
          {sortedEvents.map((event, index) => {
            const timestamp = event.lastTimestamp || event.firstTimestamp || ''
            const age = timestamp ? formatAge(timestamp) : '-'
            const source = event.source?.component || '-'
            const typeClass = event.type === 'Warning'
              ? 'text-yellow-500'
              : 'text-green-500'

            return (
              <tr
                key={`${event.reason}-${event.message}-${index}`}
                className="border-b border-border/50 hover:bg-muted/30"
              >
                <td className={`py-2 pr-4 font-medium ${typeClass}`}>
                  {event.type}
                </td>
                <td className="py-2 pr-4 text-foreground font-medium">
                  {event.reason}
                </td>
                <td className="py-2 pr-4 text-muted-foreground">
                  {age}
                  {event.count && event.count > 1 && (
                    <span className="ml-1 text-xs">({event.count}x)</span>
                  )}
                </td>
                <td className="py-2 pr-4 text-muted-foreground truncate max-w-[128px]" title={source}>
                  {source}
                </td>
                <td className="py-2 text-foreground break-words">
                  {event.message}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

interface LogsViewProps {
  logs: GetPodLogsResult | null
  loading: boolean
  selectedContainer: string | null
  onContainerChange: (container: string) => void
  onRefresh: () => void
  isTailing: boolean
  onTailToggle: () => void
}

function LogsView({ logs, loading, selectedContainer, onContainerChange, onRefresh, isTailing, onTailToggle }: LogsViewProps) {
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when logs change
  useEffect(() => {
    if (logs?.logs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs?.logs])

  if (loading && !logs) {
    return <div className="text-muted-foreground">Loading logs...</div>
  }

  // Handle container selection required
  if (logs?.availableContainers && logs.availableContainers.length > 0) {
    return (
      <div className="max-w-4xl">
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg mb-4">
          <p className="text-yellow-500 font-medium mb-2">
            This pod has multiple containers. Please select one:
          </p>
          <div className="flex flex-wrap gap-2">
            {logs.availableContainers.map((container) => (
              <button
                key={container}
                onClick={() => onContainerChange(container)}
                className="px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded border border-border transition-colors"
              >
                {container}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (logs?.error) {
    return <div className="text-red-500">{logs.error}</div>
  }

  if (!logs?.logs) {
    return (
      <div className="text-muted-foreground text-center py-8">
        No logs available for this pod
      </div>
    )
  }

  return (
    <div className="max-w-6xl">
      {/* Header with container info and controls */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {logs.container && (
            <span className="text-sm text-muted-foreground">
              Container: <span className="text-foreground font-medium">{logs.container}</span>
            </span>
          )}
          {logs.containerCount > 1 && selectedContainer && (
            <button
              onClick={() => onContainerChange('')}
              className="text-xs text-primary hover:underline"
            >
              Change container
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Tail toggle button */}
          <button
            onClick={onTailToggle}
            className={`text-xs flex items-center gap-1.5 px-3 py-1.5 rounded border transition-colors ${
              isTailing
                ? 'bg-green-500/20 text-green-400 border-green-500/50 hover:bg-green-500/30'
                : 'bg-muted/50 text-foreground border-border hover:bg-muted'
            }`}
          >
            {isTailing && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
            )}
            {isTailing ? 'Tailing...' : 'Tail'}
          </button>
          {/* Refresh button */}
          <button
            onClick={onRefresh}
            disabled={isTailing}
            className={`text-xs flex items-center gap-1.5 px-3 py-1.5 rounded border transition-colors ${
              isTailing
                ? 'bg-muted/30 text-muted-foreground/50 border-border/50 cursor-not-allowed'
                : 'bg-muted/50 text-foreground border-border hover:bg-muted'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Log output */}
      <pre className="rounded-lg bg-[#1a1a1a] p-4 overflow-auto text-sm !m-0 max-h-[70vh] font-mono text-gray-300 whitespace-pre-wrap break-all">
        {logs.logs || 'No logs available'}
        <div ref={logsEndRef} />
      </pre>
    </div>
  )
}

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
  const [searchParams, setSearchParams] = useSearchParams()

  // Get tabs available for this resource kind
  const tabs = getTabsForKind(kind)
  const validTabIds = tabs.map(t => t.id)

  // Get active tab from URL, default to 'overview'
  const tabParam = searchParams.get('tab')
  const activeTab: TabId = tabParam && validTabIds.includes(tabParam as TabId)
    ? (tabParam as TabId)
    : 'overview'

  // Update URL when tab changes
  const setActiveTab = (tab: TabId) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (tab === 'overview') {
        next.delete('tab') // Don't clutter URL for default tab
      } else {
        next.set('tab', tab)
      }
      return next
    })
  }

  const [capabilities, setCapabilities] = useState<ResourceCapabilities | null>(null)
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(true)
  const [resource, setResource] = useState<KubernetesResource | null>(null)
  const [resourceLoading, setResourceLoading] = useState(true)
  const [resourceError, setResourceError] = useState<string | null>(null)
  const [events, setEvents] = useState<KubernetesEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [eventsFetched, setEventsFetched] = useState(false)
  const [logs, setLogs] = useState<GetPodLogsResult | null>(null)
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsFetched, setLogsFetched] = useState(false)
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null)
  const [isTailing, setIsTailing] = useState(false)

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

  // Fetch events when Events tab is selected (lazy loading)
  useEffect(() => {
    if (activeTab !== 'events' || eventsFetched || !kind || !name) {
      return
    }

    const fetchEvents = async () => {
      setEventsLoading(true)
      setEventsError(null)

      // For cluster-scoped resources, namespace is '_cluster' in URL
      const ns = namespace === '_cluster' ? undefined : namespace

      const result = await getResourceEvents({
        name,
        kind,
        namespace: ns,
        uid: resource?.metadata?.uid,
      })

      if (result.error) {
        setEventsError(result.error)
        setEvents([])
      } else {
        setEvents(result.events)
      }
      setEventsLoading(false)
      setEventsFetched(true)
    }

    fetchEvents()
  }, [activeTab, eventsFetched, kind, name, namespace, resource?.metadata?.uid])

  // Fetch logs when Logs tab is selected (lazy loading, Pod only)
  useEffect(() => {
    if (activeTab !== 'logs' || kind !== 'Pod' || !name || !namespace) {
      return
    }

    // Skip if already fetched and no container change
    if (logsFetched && !selectedContainer) {
      return
    }

    const fetchLogs = async () => {
      setLogsLoading(true)

      // For cluster-scoped resources, namespace is '_cluster' in URL
      const ns = namespace === '_cluster' ? 'default' : namespace

      const result = await getPodLogs({
        name,
        namespace: ns,
        container: selectedContainer || undefined,
        tailLines: 500,
      })

      setLogs(result)
      setLogsLoading(false)
      setLogsFetched(true)
    }

    fetchLogs()
  }, [activeTab, kind, name, namespace, selectedContainer, logsFetched])

  // Handle container selection change
  const handleContainerChange = (container: string) => {
    setSelectedContainer(container || null)
    setLogsFetched(false) // Force re-fetch with new container
  }

  // Handle logs refresh
  const handleLogsRefresh = () => {
    setLogsFetched(false) // Force re-fetch
  }

  // Handle tail toggle
  const handleTailToggle = () => {
    setIsTailing((prev) => !prev)
  }

  // Polling effect for tailing logs
  useEffect(() => {
    if (!isTailing || activeTab !== 'logs' || kind !== 'Pod' || !name || !namespace) {
      return
    }

    const pollLogs = async () => {
      const ns = namespace === '_cluster' ? 'default' : namespace

      const result = await getPodLogs({
        name,
        namespace: ns,
        container: selectedContainer || undefined,
        tailLines: 500,
      })

      setLogs(result)
    }

    // Poll every 3 seconds
    const intervalId = setInterval(pollLogs, 3000)

    // Cleanup on unmount or when tailing stops
    return () => clearInterval(intervalId)
  }, [isTailing, activeTab, kind, name, namespace, selectedContainer])

  // Stop tailing when leaving logs tab
  useEffect(() => {
    if (activeTab !== 'logs' && isTailing) {
      setIsTailing(false)
    }
  }, [activeTab, isTailing])

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
          {tabs.map((tab) => (
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

            {activeTab === 'yaml' && resource && (
              <YamlView yaml={resourceToYaml(resource)} />
            )}

            {activeTab === 'events' && (
              <EventsView
                events={events}
                loading={eventsLoading}
                error={eventsError}
              />
            )}

            {activeTab === 'logs' && (
              <LogsView
                logs={logs}
                loading={logsLoading}
                selectedContainer={selectedContainer}
                onContainerChange={handleContainerChange}
                onRefresh={handleLogsRefresh}
                isTailing={isTailing}
                onTailToggle={handleTailToggle}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}
