import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { searchResources, type Resource } from '../../api/dashboard'
import {
  classifyStatus,
  getStatusColorClasses,
} from '../../utils/statusColors'
import { useActionSelection, type SelectedResource } from '../../context/ActionSelectionContext'

interface SearchResultsViewProps {
  query: string
  namespace: string
  kind?: string
  apiVersion?: string
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

function LoadingSkeleton() {
  return (
    <div className="p-6">
      <div className="mb-4">
        <div className="h-6 w-48 bg-muted/50 rounded animate-pulse" />
      </div>
      <div className="bg-muted/30 border border-border rounded-lg overflow-hidden">
        <div className="divide-y divide-border">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-4">
              <div className="h-4 w-32 bg-muted/50 rounded animate-pulse" />
              <div className="h-4 w-24 bg-muted/50 rounded animate-pulse" />
              <div className="h-4 w-20 bg-muted/50 rounded animate-pulse" />
              <div className="h-4 w-16 bg-muted/50 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Min score filter options
const MIN_SCORE_OPTIONS = [
  { value: 0, label: 'All' },
  { value: 0.4, label: '40%+' },
  { value: 0.5, label: '50%+' },
  { value: 0.7, label: '70%+' },
]

export function SearchResultsView({
  query,
  namespace,
  kind,
  apiVersion,
}: SearchResultsViewProps) {
  const [resources, setResources] = useState<Resource[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [minScore, setMinScore] = useState(0.5) // Default to 50%
  const { toggleItem, isSelected, isSelectionDisabled } = useActionSelection()

  useEffect(() => {
    if (!query) {
      setResources([])
      setTotal(0)
      setLoading(false)
      return
    }

    const fetchResults = async () => {
      setLoading(true)
      setError(null)

      try {
        const result = await searchResources({
          q: query,
          namespace: namespace === 'All Namespaces' ? undefined : namespace,
          kind,
          apiVersion,
          minScore: minScore > 0 ? minScore : undefined,
        })
        setResources(result.resources)
        setTotal(result.total)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to search resources')
        setResources([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [query, namespace, kind, apiVersion, minScore])

  if (loading) {
    return <LoadingSkeleton />
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    )
  }

  // Build empty state filter description
  const buildEmptyFilterDescription = () => {
    let description = `"${query}"`
    if (kind) {
      description += ` of type ${kind}`
    }
    if (namespace !== 'All Namespaces') {
      description += ` in namespace ${namespace}`
    }
    return description
  }

  if (resources.length === 0) {
    return (
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">Search Results</h1>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Min relevance:</label>
            <select
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="px-2 py-1 text-sm bg-muted/50 border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {MIN_SCORE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="text-center py-12">
          <svg
            className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <p className="text-lg font-medium text-foreground mb-1">No results found</p>
          <p className="text-sm text-muted-foreground">
            No resources match {buildEmptyFilterDescription()}
            {minScore > 0 && (
              <span className="block mt-1">
                Try lowering the minimum relevance filter
              </span>
            )}
          </p>
        </div>
      </div>
    )
  }

  // Group resources by kind for display
  const groupedResources = resources.reduce((acc, resource) => {
    const key = `${resource.apiGroup || 'core'}/${resource.kind}`
    if (!acc[key]) {
      acc[key] = {
        kind: resource.kind,
        apiGroup: resource.apiGroup,
        apiVersion: resource.apiVersion,
        resources: [],
      }
    }
    acc[key].resources.push(resource)
    return acc
  }, {} as Record<string, { kind: string; apiGroup: string; apiVersion: string; resources: Resource[] }>)

  // Sort groups by highest score (first resource in each group has highest score since API sorts by score)
  const sortedGroups = Object.values(groupedResources).sort((a, b) => {
    const scoreA = a.resources[0]?.score ?? 0
    const scoreB = b.resources[0]?.score ?? 0
    return scoreB - scoreA // Descending by score
  })

  // Build results summary
  const buildResultsSummary = () => {
    const resourceLabel = total === 1 ? 'resource' : 'resources'
    let summary = `${total} ${resourceLabel}`
    if (kind) {
      summary += ` of type ${kind}`
    }
    summary += ` matching "${query}"`
    if (namespace !== 'All Namespaces') {
      summary += ` in namespace ${namespace}`
    }
    return summary
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">
          Search Results
          <span className="text-sm font-normal text-muted-foreground ml-2">
            ({buildResultsSummary()})
          </span>
        </h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Min relevance:</label>
          <select
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="px-2 py-1 text-sm bg-muted/50 border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {MIN_SCORE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {sortedGroups.map((group) => {
        const fullApiVersion = group.apiGroup
          ? `${group.apiGroup}/${group.apiVersion}`
          : group.apiVersion

        return (
          <div key={`${group.apiGroup}/${group.kind}`} className="mb-6">
            <h2 className="text-base font-medium text-foreground mb-2 flex items-center gap-2">
              {group.kind}
              {group.apiGroup && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({group.apiGroup})
                </span>
              )}
              <span className="text-sm font-normal text-muted-foreground">
                ({group.resources.length})
              </span>
            </h2>

            <div className="bg-muted/30 border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Name
                    </th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">
                      Relevance
                    </th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Namespace
                    </th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Age
                    </th>
                    <th className="w-12 px-2 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider text-center">
                      AI
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {group.resources.map((resource) => {
                    const selectedResource: SelectedResource = {
                      kind: resource.kind,
                      apiVersion: fullApiVersion,
                      namespace: resource.namespace,
                      name: resource.name,
                    }
                    const rowSelected = isSelected(selectedResource)

                    // Build detail URL
                    const versionOnly = group.apiVersion.includes('/')
                      ? group.apiVersion.split('/').pop()
                      : group.apiVersion
                    const detailUrl = `/dashboard/${group.apiGroup || '_core'}/${versionOnly}/${group.kind}/${resource.namespace || '_cluster'}/${resource.name}`

                    // Try to get status from resource
                    let statusValue = '-'
                    if (resource.status && typeof resource.status === 'object') {
                      const phase = (resource.status as Record<string, unknown>).phase
                      if (phase && typeof phase === 'string') {
                        statusValue = phase
                      }
                    }
                    const statusClass = statusValue !== '-'
                      ? getStatusColorClasses(classifyStatus(statusValue))
                      : 'text-muted-foreground'

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
                          {statusValue !== '-' && (
                            <span className={`ml-2 text-xs ${statusClass}`}>
                              ({statusValue})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {resource.score !== undefined ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              resource.score >= 0.7
                                ? 'bg-green-500/20 text-green-400'
                                : resource.score >= 0.4
                                  ? 'bg-yellow-500/20 text-yellow-400'
                                  : 'bg-zinc-500/20 text-zinc-400'
                            }`}>
                              {Math.floor(resource.score * 100)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-muted-foreground">
                          {resource.namespace || '-'}
                        </td>
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
      })}
    </div>
  )
}
