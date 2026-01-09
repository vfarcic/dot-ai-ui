import { useState, useEffect } from 'react'
import {
  getResourceKinds,
  groupKindsByApiGroup,
  sortApiGroups,
  type ResourceKind,
} from '../../api/dashboard'

interface DashboardSidebarProps {
  selectedResource: ResourceKind | null
  onSelectResource: (resource: ResourceKind) => void
  namespace: string
  isCollapsed: boolean
  onToggleCollapse: () => void
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
  namespace,
  isCollapsed,
  onToggleCollapse,
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

        {!loading && !error && sortedGroups.map((groupName) => {
          const kinds = kindsByGroup.get(groupName) || []
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
