import { useState, useEffect, useMemo } from 'react'
import {
  getResourceKinds,
  groupKindsByApiGroup,
  sortApiGroups,
  type ResourceKind,
} from '../../api/dashboard'

interface DashboardSidebarProps {
  selectedResource: ResourceKind | null
  onSelectResource: (resource: ResourceKind) => void
  onClearSelection?: () => void
  namespace: string
  isCollapsed: boolean
  onToggleCollapse: () => void
  onResourcesLoaded?: (hasResources: boolean) => void
  onKindsLoaded?: (kinds: ResourceKind[]) => void
  /** When search is active, filter sidebar to only show these kinds */
  searchResultKinds?: ResourceKind[] | null
}

function ChevronIcon({
  className,
  isOpen,
}: {
  className?: string
  isOpen: boolean
}) {
  return (
    <svg
      className={`${className} transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  )
}

function CollapseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
      />
    </svg>
  )
}

function ExpandIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M13 5l7 7-7 7M5 5l7 7-7 7"
      />
    </svg>
  )
}

function ApiGroupIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
      />
    </svg>
  )
}

function getGroupAbbreviation(groupName: string): string {
  if (groupName === 'core') return 'core'
  // For domain-style names like "apps", "policy", use as-is if short
  if (groupName.length <= 4) return groupName
  // For longer names like "networking.k8s.io", take first part
  const firstPart = groupName.split('.')[0]
  if (firstPart.length <= 4) return firstPart
  return firstPart.slice(0, 3)
}

export function DashboardSidebar({
  selectedResource,
  onSelectResource,
  onClearSelection,
  namespace,
  isCollapsed,
  onToggleCollapse,
  onResourcesLoaded,
  onKindsLoaded,
  searchResultKinds,
}: DashboardSidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [kindsByGroup, setKindsByGroup] = useState<Map<string, ResourceKind[]>>(new Map())
  const [sortedGroups, setSortedGroups] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchKinds() {
      try {
        setLoading(true)
        setError(null)
        // Pass namespace filter (undefined for "All Namespaces")
        const namespaceFilter = namespace === 'All Namespaces' ? undefined : namespace
        const kinds = await getResourceKinds(namespaceFilter)
        const grouped = groupKindsByApiGroup(kinds)
        setKindsByGroup(grouped)
        const groups = sortApiGroups(Array.from(grouped.keys()))
        setSortedGroups(groups)
        // Only expand "core" by default on initial load
        if (expandedGroups.size === 0) {
          setExpandedGroups(new Set(['core']))
        }
        // Notify parent about resources state
        onResourcesLoaded?.(groups.length > 0)

        // Pass all kinds to parent for "all resources" view
        onKindsLoaded?.(kinds)

        // Check if currently selected resource still exists in the loaded kinds
        // If not, clear the selection (handles namespace changes where resource doesn't exist)
        if (selectedResource && onClearSelection) {
          const selectedExists = kinds.some(
            (k) =>
              k.kind === selectedResource.kind &&
              k.apiGroup === selectedResource.apiGroup &&
              k.apiVersion === selectedResource.apiVersion
          )
          if (!selectedExists) {
            onClearSelection()
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load resources')
      } finally {
        setLoading(false)
      }
    }
    fetchKinds()
  }, [namespace])

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupName)) {
        next.delete(groupName)
      } else {
        next.add(groupName)
      }
      return next
    })
  }

  const isResourceSelected = (resourceKind: ResourceKind) => {
    if (!selectedResource) return false
    return (
      selectedResource.kind === resourceKind.kind &&
      selectedResource.apiGroup === resourceKind.apiGroup &&
      selectedResource.apiVersion === resourceKind.apiVersion
    )
  }

  // Compute filtered display data when search is active
  const { displayGroups, displayKindsByGroup } = useMemo(() => {
    // If no search results filter, show all kinds
    if (!searchResultKinds || searchResultKinds.length === 0) {
      return { displayGroups: sortedGroups, displayKindsByGroup: kindsByGroup }
    }

    // Create a set of search result kind keys for fast lookup
    // Normalize: use just kind name since apiGroup/apiVersion formats may differ
    // between search results and sidebar kinds
    const searchKindNames = new Set(
      searchResultKinds.map((k) => k.kind)
    )

    // Filter kindsByGroup to only include kinds from search results
    const filteredKindsByGroup = new Map<string, ResourceKind[]>()
    for (const [group, kinds] of kindsByGroup) {
      const filteredKinds = kinds.filter((k) => searchKindNames.has(k.kind))
      if (filteredKinds.length > 0) {
        filteredKindsByGroup.set(group, filteredKinds)
      }
    }

    // Get sorted groups that have matching kinds
    const filteredGroups = sortApiGroups(Array.from(filteredKindsByGroup.keys()))

    return { displayGroups: filteredGroups, displayKindsByGroup: filteredKindsByGroup }
  }, [searchResultKinds, sortedGroups, kindsByGroup])

  return (
    <aside
      className={`bg-header-bg border-r border-border flex flex-col transition-all duration-300 ${
        isCollapsed ? 'w-14' : 'w-64'
      }`}
    >
      {/* Collapse toggle */}
      <div className="p-2 border-b border-border flex justify-end">
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ExpandIcon className="w-4 h-4" />
          ) : (
            <CollapseIcon className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Resource groups */}
      <nav className="flex-1 overflow-y-auto py-2">
        {loading && (
          <div className="px-3 py-2 text-sm text-muted-foreground">
            Loading resources...
          </div>
        )}

        {error && (
          <div className="px-3 py-2 text-sm text-red-500">
            {error}
          </div>
        )}

        {!loading && !error && displayGroups.length === 0 && (
          <div className="px-3 py-4 text-sm">
            <div className="text-yellow-500 font-medium mb-2">
              No resources indexed
            </div>
            <p className="text-muted-foreground text-xs mb-3">
              The dot-ai-controller may not be running or hasn't synced resources yet.
            </p>
            <a
              href="https://devopstoolkit.ai/docs/controller/resource-sync-guide"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline text-xs"
            >
              View resource sync guide →
            </a>
          </div>
        )}

        {/* "All" button - shows all resources in selected namespace */}
        {!loading && !error && displayGroups.length > 0 && namespace !== 'All Namespaces' && !searchResultKinds && (
          <div className="mb-2 border-b border-border pb-2">
            <button
              onClick={() => onClearSelection?.()}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${
                isCollapsed ? 'justify-center' : ''
              } ${
                !selectedResource
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-primary/10'
              }`}
              title="Show all resources"
            >
              {isCollapsed ? (
                <span className="text-xs font-semibold uppercase tracking-tight">ALL</span>
              ) : (
                <>
                  <svg
                    className="w-4 h-4 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 6h16M4 10h16M4 14h16M4 18h16"
                    />
                  </svg>
                  <span className="flex-1 text-left">All Resources</span>
                </>
              )}
            </button>
          </div>
        )}

        {!loading && !error && displayGroups.length > 0 && displayGroups.map((groupName) => {
          const kinds = displayKindsByGroup.get(groupName) || []
          const isExpanded = expandedGroups.has(groupName)
          const totalCount = kinds.reduce((sum, k) => sum + k.count, 0)

          return (
            <div key={groupName} className="mb-1">
              {/* Group header */}
              <button
                onClick={() => {
                  if (isCollapsed) {
                    // When collapsed, expand sidebar and open this group
                    onToggleCollapse()
                    setExpandedGroups((prev) => new Set(prev).add(groupName))
                  } else {
                    toggleGroup(groupName)
                  }
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-colors ${
                  isCollapsed ? 'justify-center' : ''
                }`}
                title={`${groupName} (${totalCount})`}
              >
                {isCollapsed ? (
                  <span className="text-xs font-semibold uppercase tracking-tight">
                    {getGroupAbbreviation(groupName)}
                  </span>
                ) : (
                  <>
                    <ApiGroupIcon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 text-left truncate">{groupName}</span>
                    <span className="text-xs text-muted-foreground/70">{totalCount}</span>
                    <ChevronIcon className="w-3 h-3" isOpen={isExpanded} />
                  </>
                )}
              </button>

              {/* Resource kinds */}
              {!isCollapsed && isExpanded && (
                <div className="ml-4 border-l border-border">
                  {kinds.map((resourceKind) => {
                    const selected = isResourceSelected(resourceKind)

                    return (
                      <button
                        key={`${groupName}/${resourceKind.kind}`}
                        onClick={() => onSelectResource(resourceKind)}
                        className={`w-full text-left px-4 py-1.5 text-sm transition-colors flex items-center justify-between ${
                          selected
                            ? 'text-primary bg-primary/10 border-l-2 border-primary -ml-px'
                            : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
                        }`}
                      >
                        <span className="truncate">{resourceKind.kind}</span>
                        <span className="text-xs text-muted-foreground/70 ml-2">
                          {resourceKind.count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
