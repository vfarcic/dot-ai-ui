import { useState, useEffect } from 'react'
import {
  getResources,
  type ResourceKind,
  type Resource,
} from '../../api/dashboard'

interface ResourceListProps {
  resourceKind: ResourceKind
  namespace: string
}

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

export function ResourceList({ resourceKind, namespace }: ResourceListProps) {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchResources = async () => {
    try {
      setLoading(true)
      setError(null)

      const namespaceParam = namespace === 'All Namespaces' ? undefined : namespace

      const result = await getResources({
        kind: resourceKind.kind,
        apiGroup: resourceKind.apiGroup,
        apiVersion: resourceKind.apiVersion,
        namespace: namespaceParam,
      })

      setResources(result.resources)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchResources()
  }, [resourceKind.kind, resourceKind.apiGroup, resourceKind.apiVersion, namespace])

  if (loading) {
    return <LoadingSkeleton />
  }

  if (error) {
    return <ErrorState error={error} onRetry={fetchResources} />
  }

  if (resources.length === 0) {
    return <EmptyState kind={resourceKind.kind} namespace={namespace} />
  }

  // Determine if resources have namespace (cluster-scoped resources won't)
  const hasNamespace = resources.some((r) => r.namespace)

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Name
            </th>
            {hasNamespace && (
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Namespace
              </th>
            )}
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Age
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
                <span className="font-medium text-foreground hover:text-primary cursor-pointer">
                  {resource.name}
                </span>
              </td>
              {hasNamespace && (
                <td className="px-4 py-3 text-sm">
                  <span className="text-muted-foreground">
                    {resource.namespace || '-'}
                  </span>
                </td>
              )}
              <td className="px-4 py-3 text-sm">
                <span className="text-muted-foreground">
                  {formatAge(resource.createdAt)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
