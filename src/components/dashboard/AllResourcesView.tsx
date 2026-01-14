import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  getResources,
  getCapabilities,
  getBuiltinResourceColumns,
  DEFAULT_COLUMNS,
  type ResourceKind,
  type Resource,
  type ResourceCapabilities,
} from '../../api/dashboard'
import {
  classifyStatus,
  getStatusColorClasses,
  isStatusColumn,
} from '../../utils/statusColors'
import { useActionSelection, type SelectedResource } from '../../context/ActionSelectionContext'

interface AllResourcesViewProps {
  kinds: ResourceKind[]
  namespace: string
  onNamespaceClick?: (namespace: string) => void
  onKindClick?: (kind: ResourceKind) => void
}

interface KindSection {
  kind: ResourceKind
  resources: Resource[]
  capabilities: ResourceCapabilities | null
  loading: boolean
  error: string | null
}

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

function QueryIcon({ selected }: { selected: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-colors ${selected ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}

function KindSectionView({
  section,
  namespace,
  onNamespaceClick,
  onKindClick,
}: {
  section: KindSection
  namespace: string
  onNamespaceClick?: (namespace: string) => void
  onKindClick?: (kind: ResourceKind) => void
}) {
  const { toggleItem, isSelected, isSelectionDisabled } = useActionSelection()
  const { kind, resources, capabilities, loading, error } = section

  // Build apiVersion for selection context
  const apiVersion = kind.apiGroup
    ? `${kind.apiGroup}/${kind.apiVersion}`
    : kind.apiVersion

  const buildSelectedResource = useCallback((resource: Resource): SelectedResource => ({
    kind: kind.kind,
    apiVersion,
    namespace: resource.namespace,
    name: resource.name,
  }), [kind.kind, apiVersion])

  // Get columns - use simplified set for overview
  const printerColumns = capabilities?.printerColumns || DEFAULT_COLUMNS
  // Only show Name, Status (if available), Age columns for compact view
  const statusColumn = printerColumns.find(col => isStatusColumn(col.name, col.jsonPath))

  if (loading) {
    return (
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-2">{kind.kind}</h2>
        <div className="bg-muted/30 border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
            <span>Loading...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-2">{kind.kind}</h2>
        <div className="bg-muted/30 border border-border rounded-lg p-4">
          <div className="text-red-400 text-sm">{error}</div>
        </div>
      </div>
    )
  }

  if (resources.length === 0) {
    return null // Don't show empty sections
  }

  return (
    <div className="mb-6">
      <button
        onClick={() => onKindClick?.(kind)}
        className="text-lg font-semibold text-foreground mb-2 hover:text-primary transition-colors cursor-pointer flex items-center gap-2"
      >
        {kind.kind}
        {kind.apiGroup && (
          <span className="text-sm font-normal text-muted-foreground">
            ({kind.apiGroup})
          </span>
        )}
        <span className="text-sm font-normal text-muted-foreground">
          ({resources.length})
        </span>
      </button>
      {capabilities?.description && (
        <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
          {capabilities.description}
        </p>
      )}
      <div className="bg-muted/30 border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Name
              </th>
              {namespace === 'All Namespaces' && (
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Namespace
                </th>
              )}
              {statusColumn && (
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
              )}
              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Age
              </th>
              <th className="w-12 px-2 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider text-center">
                AI
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {resources.map((resource) => {
              const selectedResource = buildSelectedResource(resource)
              const rowSelected = isSelected(selectedResource)

              // Extract status value
              let statusValue = '-'
              if (statusColumn && resource.status) {
                const path = statusColumn.jsonPath.replace(/^\.status\.?/, '')
                const parts = path.split('.')
                let val: unknown = resource.status
                for (const part of parts) {
                  if (val && typeof val === 'object') {
                    val = (val as Record<string, unknown>)[part]
                  } else {
                    val = undefined
                    break
                  }
                }
                if (val !== undefined && val !== null) {
                  statusValue = String(val)
                }
              }

              const statusClass = statusColumn
                ? getStatusColorClasses(classifyStatus(statusValue))
                : 'text-muted-foreground'

              // Build detail URL
              const versionOnly = kind.apiVersion.includes('/')
                ? kind.apiVersion.split('/').pop()
                : kind.apiVersion
              const detailUrl = `/dashboard/${kind.apiGroup || '_core'}/${versionOnly}/${kind.kind}/${resource.namespace || '_cluster'}/${resource.name}`

              return (
                <tr
                  key={`${resource.namespace || 'cluster'}/${resource.name}`}
                  className={`transition-colors ${
                    rowSelected
                      ? 'bg-primary/10 hover:bg-primary/15'
                      : 'hover:bg-muted/30'
                  }`}
                >
                  <td className="px-4 py-2 text-sm">
                    <Link
                      to={detailUrl}
                      className="font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {resource.name}
                    </Link>
                  </td>
                  {namespace === 'All Namespaces' && (
                    <td className="px-4 py-2 text-sm">
                      {resource.namespace && onNamespaceClick ? (
                        <button
                          onClick={() => onNamespaceClick(resource.namespace!)}
                          className="text-muted-foreground hover:text-primary cursor-pointer transition-colors"
                        >
                          {resource.namespace}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">{resource.namespace || '-'}</span>
                      )}
                    </td>
                  )}
                  {statusColumn && (
                    <td className="px-4 py-2 text-sm">
                      <span className={statusClass}>{statusValue}</span>
                    </td>
                  )}
                  <td className="px-4 py-2 text-sm text-muted-foreground">
                    {formatAge(resource.createdAt)}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => !isSelectionDisabled && toggleItem(selectedResource)}
                      disabled={isSelectionDisabled}
                      className={`p-1.5 rounded-md transition-all ${
                        isSelectionDisabled
                          ? 'opacity-30 cursor-not-allowed'
                          : rowSelected
                            ? 'bg-primary/20 ring-2 ring-primary/50'
                            : 'hover:bg-muted/50'
                      }`}
                      title={isSelectionDisabled
                        ? 'Selection not available for Recommend tool'
                        : rowSelected
                          ? `Remove from query: ${resource.name}`
                          : `Add to query: ${resource.name}`
                      }
                    >
                      <QueryIcon selected={rowSelected} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function AllResourcesView({
  kinds,
  namespace,
  onNamespaceClick,
  onKindClick,
}: AllResourcesViewProps) {
  const [sections, setSections] = useState<Map<string, KindSection>>(new Map())

  // Fetch resources for all kinds in parallel
  useEffect(() => {
    if (kinds.length === 0) return

    // Initialize sections
    const initialSections = new Map<string, KindSection>()
    for (const kind of kinds) {
      const key = `${kind.apiGroup}/${kind.kind}`
      initialSections.set(key, {
        kind,
        resources: [],
        capabilities: null,
        loading: true,
        error: null,
      })
    }
    setSections(initialSections)

    // Fetch resources for each kind in parallel
    const namespaceParam = namespace === 'All Namespaces' ? undefined : namespace

    for (const kind of kinds) {
      const key = `${kind.apiGroup}/${kind.kind}`

      // Fetch resources and capabilities in parallel
      Promise.all([
        getResources({
          kind: kind.kind,
          apiGroup: kind.apiGroup,
          apiVersion: kind.apiVersion,
          namespace: namespaceParam,
          includeStatus: true,
        }),
        getCapabilities({
          kind: kind.kind,
          apiVersion: kind.apiGroup
            ? `${kind.apiGroup}/${kind.apiVersion}`
            : kind.apiVersion,
        }),
      ])
        .then(([resourcesResult, capabilitiesResult]) => {
          // Get printer columns
          const builtinColumns = getBuiltinResourceColumns(kind.kind, kind.apiVersion)
          let capabilities: ResourceCapabilities | null = null

          if (builtinColumns) {
            capabilities = {
              kind: kind.kind,
              apiVersion: kind.apiVersion,
              printerColumns: builtinColumns,
              description: capabilitiesResult.data?.description,
              useCase: capabilitiesResult.data?.useCase,
            }
          } else if (capabilitiesResult.data) {
            const validColumns = (capabilitiesResult.data.printerColumns || []).filter((col) => {
              if (!col.jsonPath || col.jsonPath.trim() === '') return false
              if (col.jsonPath.startsWith('.spec')) return false
              return true
            })
            capabilities = {
              ...capabilitiesResult.data,
              printerColumns: validColumns.length > 0 ? validColumns : DEFAULT_COLUMNS,
            }
          }

          setSections((prev) => {
            const next = new Map(prev)
            next.set(key, {
              kind,
              resources: resourcesResult.resources,
              capabilities,
              loading: false,
              error: null,
            })
            return next
          })
        })
        .catch((err) => {
          setSections((prev) => {
            const next = new Map(prev)
            next.set(key, {
              kind,
              resources: [],
              capabilities: null,
              loading: false,
              error: err instanceof Error ? err.message : 'Failed to load',
            })
            return next
          })
        })
    }
  }, [kinds, namespace])

  if (kinds.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-muted-foreground">
          <p className="text-lg">No resources in this namespace</p>
        </div>
      </div>
    )
  }

  // Sort sections by kind name
  const sortedSections = Array.from(sections.values()).sort((a, b) =>
    a.kind.kind.localeCompare(b.kind.kind)
  )

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-foreground mb-4">
        All Resources
        {namespace !== 'All Namespaces' && (
          <span className="text-sm font-normal text-muted-foreground ml-2">
            in {namespace}
          </span>
        )}
      </h1>
      {sortedSections.map((section) => (
        <KindSectionView
          key={`${section.kind.apiGroup}/${section.kind.kind}`}
          section={section}
          namespace={namespace}
          onNamespaceClick={onNamespaceClick}
          onKindClick={onKindClick}
        />
      ))}
    </div>
  )
}
