import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  getResources,
  getCapabilities,
  getBuiltinResourceColumns,
  DEFAULT_COLUMNS,
  type ResourceKind,
  type Resource,
  type PrinterColumn,
} from '../../api/dashboard'

interface ResourceListProps {
  resourceKind: ResourceKind
  namespace: string
  onNamespaceClick?: (namespace: string) => void
}

type SortDirection = 'asc' | 'desc'

interface SortState {
  column: string // column name
  direction: SortDirection
}

// ============================================================================
// JSONPath Value Extraction
// ============================================================================

/**
 * Extract a value from an object using a simplified JSONPath expression
 * Supports paths like: .metadata.name, .status.phase, .spec.replicas
 * Does not support full JSONPath syntax (arrays with filters, etc.)
 */
function extractJsonPathValue(obj: unknown, jsonPath: string): unknown {
  if (!jsonPath || !obj) return undefined

  // Remove leading dot if present
  const path = jsonPath.startsWith('.') ? jsonPath.slice(1) : jsonPath

  // Split on dots, handling array notation like containers[0]
  const parts = path.split(/\.(?![^\[]*\])/)

  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined

    // Handle array notation like containers[0] or containers[*]
    const arrayMatch = part.match(/^([^[]+)\[(\d+|\*)\]$/)
    if (arrayMatch) {
      const [, key, indexStr] = arrayMatch
      const record = current as Record<string, unknown>
      const arr = record[key]
      if (!Array.isArray(arr)) return undefined

      if (indexStr === '*') {
        // Return all items - join as comma-separated
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

/**
 * Format a value for display in the table
 */
function formatColumnValue(value: unknown, columnType: string): string {
  if (value === null || value === undefined) return '-'

  if (columnType === 'date') {
    // Format as age
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
// Helpers
// ============================================================================

/**
 * Format a date string as a human-readable age (e.g., "2d", "5h", "30m")
 */
function formatAge(createdAt: string): string {
  const created = new Date(createdAt)
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

function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-border">
        <div className="flex px-4 py-3 gap-4">
          <div className="h-4 bg-muted rounded w-24" />
          <div className="h-4 bg-muted rounded w-20" />
          <div className="h-4 bg-muted rounded w-16" />
        </div>
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex px-4 py-3 gap-4 border-b border-border last:border-b-0">
          <div className="h-4 bg-muted/50 rounded w-32" />
          <div className="h-4 bg-muted/50 rounded w-24" />
          <div className="h-4 bg-muted/50 rounded w-12" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ kind, namespace }: { kind: string; namespace: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <svg
        className="w-12 h-12 text-muted-foreground mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
        />
      </svg>
      <h3 className="text-lg font-medium text-foreground mb-1">
        No {kind} found
      </h3>
      <p className="text-sm text-muted-foreground">
        {namespace === 'All Namespaces'
          ? `No ${kind.toLowerCase()} exist in any namespace`
          : `No ${kind.toLowerCase()} exist in the "${namespace}" namespace`}
      </p>
    </div>
  )
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <svg
        className="w-12 h-12 text-red-500 mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <h3 className="text-lg font-medium text-foreground mb-1">
        Failed to load resources
      </h3>
      <p className="text-sm text-muted-foreground mb-4">{error}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Retry
      </button>
    </div>
  )
}

function StatusLoadingIndicator() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-pulse" />
      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-pulse [animation-delay:0.2s]" />
      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-pulse [animation-delay:0.4s]" />
    </span>
  )
}

function SortIcon({ direction, active }: { direction: SortDirection; active: boolean }) {
  return (
    <svg
      className={`w-3 h-3 ml-1 inline-block transition-colors ${
        active ? 'text-foreground' : 'text-muted-foreground/30'
      }`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      {direction === 'asc' ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      )}
    </svg>
  )
}

export function ResourceList({ resourceKind, namespace, onNamespaceClick }: ResourceListProps) {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [statusLoading, setStatusLoading] = useState(true) // Start as true - we'll fetch status after metadata
  const [error, setError] = useState<string | null>(null)
  const [printerColumns, setPrinterColumns] = useState<PrinterColumn[]>([])
  const [columnsLoaded, setColumnsLoaded] = useState(false)
  const [sort, setSort] = useState<SortState>({ column: 'Name', direction: 'asc' })

  const namespaceParam = namespace === 'All Namespaces' ? undefined : namespace

  // Handle column header click for sorting
  const handleSort = useCallback((columnName: string) => {
    setSort((prev) => {
      if (prev.column === columnName) {
        // Toggle direction if same column
        return { column: columnName, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      // New column - start with ascending
      return { column: columnName, direction: 'asc' }
    })
  }, [])

  // Fetch capabilities (printer columns) for this resource kind
  // Priority: 1) Hardcoded core columns, 2) MCP, 3) Default fallback
  useEffect(() => {
    const fetchCapabilities = async () => {
      setColumnsLoaded(false)
      setPrinterColumns([])

      // apiVersion may already be full (e.g., "dot-ai.devopstoolkit.live/v1alpha1") or just version (e.g., "v1")
      const apiVersion = resourceKind.apiVersion.includes('/')
        ? resourceKind.apiVersion
        : resourceKind.apiGroup
          ? `${resourceKind.apiGroup}/${resourceKind.apiVersion}`
          : resourceKind.apiVersion

      // 1) Check for hardcoded built-in resource columns first
      const builtinColumns = getBuiltinResourceColumns(resourceKind.kind, resourceKind.apiVersion)
      if (builtinColumns) {
        setPrinterColumns(builtinColumns)
        setColumnsLoaded(true)
        return
      }

      // 2) Fetch from MCP for CRDs and other resources
      const result = await getCapabilities({
        kind: resourceKind.kind,
        apiVersion,
      })

      if (result.error) {
        // MCP failed - use default fallback columns
        setPrinterColumns(DEFAULT_COLUMNS)
      } else if (result.data?.printerColumns && result.data.printerColumns.length > 0) {
        // Filter out columns with empty jsonPath or .spec references (MCP doesn't return spec)
        const validColumns = result.data.printerColumns.filter((col) => {
          // Must have a non-empty jsonPath
          if (!col.jsonPath || col.jsonPath.trim() === '') return false
          // Filter out .spec references since MCP doesn't return spec data
          if (col.jsonPath.startsWith('.spec')) return false
          return true
        })

        if (validColumns.length > 0) {
          setPrinterColumns(validColumns)
        } else {
          // All columns were filtered out - use default fallback
          setPrinterColumns(DEFAULT_COLUMNS)
        }
      } else {
        // 3) MCP returned empty - use default fallback columns
        setPrinterColumns(DEFAULT_COLUMNS)
      }
      setColumnsLoaded(true)
    }
    fetchCapabilities()
  }, [resourceKind.kind, resourceKind.apiGroup, resourceKind.apiVersion])

  // Fetch resources without status (fast), then with status (slower)
  const fetchResources = useCallback(async () => {
    try {
      setLoading(true)
      setStatusLoading(true)
      setError(null)

      // First: fetch metadata only (fast)
      const result = await getResources({
        kind: resourceKind.kind,
        apiGroup: resourceKind.apiGroup,
        apiVersion: resourceKind.apiVersion,
        namespace: namespaceParam,
      })

      setResources(result.resources)
      setLoading(false)

      // Second: fetch with status in background (slower)
      if (result.resources.length > 0) {
        try {
          const resultWithStatus = await getResources({
            kind: resourceKind.kind,
            apiGroup: resourceKind.apiGroup,
            apiVersion: resourceKind.apiVersion,
            namespace: namespaceParam,
            includeStatus: true,
          })
          setResources(resultWithStatus.resources)
        } catch (err) {
          // Silently fail status fetch - we still have metadata
          console.warn('Failed to fetch resource status:', err)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      setLoading(false)
    } finally {
      setStatusLoading(false)
    }
  }, [resourceKind.kind, resourceKind.apiGroup, resourceKind.apiVersion, namespaceParam])

  useEffect(() => {
    fetchResources()
  }, [fetchResources])

  // Compute standard columns (must be before any early returns due to hooks rules)
  const standardColumns = useMemo(() => {
    // Filter printer columns to priority 0 only (standard kubectl get columns)
    let cols = printerColumns.filter((col) => (col.priority ?? 0) === 0)

    // When viewing "All Namespaces", always include Namespace column after Name
    const showingAllNamespaces = namespace === 'All Namespaces'
    const hasNamespaceColumn = cols.some(
      (col) => col.name.toLowerCase() === 'namespace' || col.jsonPath === '.metadata.namespace'
    )
    if (showingAllNamespaces && !hasNamespaceColumn) {
      const nameIndex = cols.findIndex((col) => col.name.toLowerCase() === 'name')
      const namespaceColumn: PrinterColumn = {
        name: 'Namespace',
        type: 'string',
        jsonPath: '.metadata.namespace',
        priority: 0,
      }
      if (nameIndex >= 0) {
        // Insert after Name column
        cols = [
          ...cols.slice(0, nameIndex + 1),
          namespaceColumn,
          ...cols.slice(nameIndex + 1),
        ]
      } else {
        // Prepend if no Name column found
        cols = [namespaceColumn, ...cols]
      }
    }
    return cols
  }, [printerColumns, namespace])

  // Sort resources based on current sort state (must be before any early returns)
  const sortedResources = useMemo(() => {
    if (resources.length === 0) return resources

    const sortColumn = standardColumns.find((col) => col.name === sort.column)
    if (!sortColumn) return resources

    return [...resources].sort((a, b) => {
      // Build full resource objects for JSONPath extraction
      const fullA = {
        metadata: {
          name: a.name,
          namespace: a.namespace,
          labels: a.labels,
          creationTimestamp: a.createdAt,
        },
        spec: a.spec,
        status: a.status,
        ...a,
      }
      const fullB = {
        metadata: {
          name: b.name,
          namespace: b.namespace,
          labels: b.labels,
          creationTimestamp: b.createdAt,
        },
        spec: b.spec,
        status: b.status,
        ...b,
      }

      const valueA = extractJsonPathValue(fullA, sortColumn.jsonPath)
      const valueB = extractJsonPathValue(fullB, sortColumn.jsonPath)

      // Handle null/undefined values - sort them to the end
      if (valueA === null || valueA === undefined) return sort.direction === 'asc' ? 1 : -1
      if (valueB === null || valueB === undefined) return sort.direction === 'asc' ? -1 : 1

      let comparison = 0

      // Type-aware comparison
      if (sortColumn.type === 'date') {
        const dateA = new Date(String(valueA)).getTime()
        const dateB = new Date(String(valueB)).getTime()
        comparison = dateA - dateB
      } else if (sortColumn.type === 'integer' || sortColumn.type === 'number') {
        const numA = Number(valueA) || 0
        const numB = Number(valueB) || 0
        comparison = numA - numB
      } else {
        // String comparison (case-insensitive)
        comparison = String(valueA).toLowerCase().localeCompare(String(valueB).toLowerCase())
      }

      return sort.direction === 'asc' ? comparison : -comparison
    })
  }, [resources, standardColumns, sort])

  const columnsLoading = !columnsLoaded

  // Early returns after all hooks
  if (loading) {
    return <LoadingSkeleton />
  }

  if (error) {
    return <ErrorState error={error} onRetry={fetchResources} />
  }

  if (resources.length === 0) {
    return <EmptyState kind={resourceKind.kind} namespace={namespace} />
  }

  // Show placeholder table while printer columns are loading
  if (columnsLoading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Name
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {resources.map((resource) => (
              <tr
                key={`${resource.namespace || 'cluster'}/${resource.name}`}
                className="hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-3 text-sm">
                  <span className="font-medium text-foreground">
                    {resource.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <StatusLoadingIndicator />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            {standardColumns.map((col) => {
              const isActive = sort.column === col.name
              return (
                <th
                  key={col.name}
                  className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-primary hover:bg-primary/10 transition-colors select-none"
                  title={col.description || `Sort by ${col.name}`}
                  onClick={() => handleSort(col.name)}
                >
                  {col.name}
                  <SortIcon
                    direction={isActive ? sort.direction : 'asc'}
                    active={isActive}
                  />
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sortedResources.map((resource) => {
            // Build a resource object for JSONPath extraction
            const fullResource = {
              metadata: {
                name: resource.name,
                namespace: resource.namespace,
                labels: resource.labels,
                creationTimestamp: resource.createdAt,
              },
              spec: resource.spec,
              status: resource.status,
              ...resource,
            }

            return (
              <tr
                key={`${resource.namespace || 'cluster'}/${resource.name}`}
                className="hover:bg-muted/30 transition-colors"
              >
                {standardColumns.map((col) => {
                  const value = extractJsonPathValue(fullResource, col.jsonPath)
                  const displayValue = formatColumnValue(value, col.type)
                  const isName = col.name.toLowerCase() === 'name'
                  const isNamespace = col.name.toLowerCase() === 'namespace' || col.jsonPath === '.metadata.namespace'
                  const isStatusColumn = col.jsonPath.startsWith('.status')
                  const isLoading = isStatusColumn && statusLoading && (value === null || value === undefined)
                  const namespaceValue = isNamespace && typeof value === 'string' ? value : null

                  return (
                    <td key={col.name} className="px-4 py-3 text-sm">
                      {isLoading ? (
                        <StatusLoadingIndicator />
                      ) : isName ? (
                        <span className="font-medium text-foreground hover:text-primary cursor-pointer">
                          {displayValue}
                        </span>
                      ) : isNamespace && namespaceValue && onNamespaceClick ? (
                        <button
                          onClick={() => onNamespaceClick(namespaceValue)}
                          className="text-muted-foreground hover:text-primary cursor-pointer transition-colors"
                          title={`Filter by namespace "${namespaceValue}"`}
                        >
                          {displayValue}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">{displayValue}</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
