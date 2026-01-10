import { useState, useCallback, createContext, useContext } from 'react'
import { Link, Outlet, useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { DashboardSidebar } from './DashboardSidebar'
import { NamespaceSelector } from './NamespaceSelector'
import type { ResourceKind } from '../../api/dashboard'

// URL param keys (short for cleaner URLs)
const PARAM_NAMESPACE = 'ns'
const PARAM_KIND = 'kind'
const PARAM_GROUP = 'group'
const PARAM_VERSION = 'version'
const PARAM_SIDEBAR = 'sb' // '1' = collapsed

// Context for sharing dashboard state with child components
interface DashboardContextValue {
  selectedNamespace: string
  setSelectedNamespace: (ns: string) => void
  selectedResource: ResourceKind | null
  setSelectedResource: (resource: ResourceKind) => void
  hasResources: boolean | null
  sidebarCollapsed: boolean
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

export function useDashboardContext() {
  const context = useContext(DashboardContext)
  if (!context) {
    throw new Error('useDashboardContext must be used within SharedDashboardLayout')
  }
  return context
}

interface SharedDashboardLayoutProps {
  /** Whether sidebar should be collapsed by default (e.g., for visualization pages) */
  defaultCollapsed?: boolean
  /** Whether to show the sidebar at all */
  showSidebar?: boolean
}

export function SharedDashboardLayout({
  defaultCollapsed = false,
  showSidebar = true,
}: SharedDashboardLayoutProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [hasResources, setHasResources] = useState<boolean | null>(null)
  const navigate = useNavigate()
  const location = useLocation()

  // Read state from URL params
  const namespaceFromUrl = searchParams.get(PARAM_NAMESPACE)
  const kindFromUrl = searchParams.get(PARAM_KIND)
  const groupFromUrl = searchParams.get(PARAM_GROUP)
  const versionFromUrl = searchParams.get(PARAM_VERSION)
  const sidebarFromUrl = searchParams.get(PARAM_SIDEBAR)

  // Sidebar state: URL param takes precedence, then defaultCollapsed
  // sb=1 means collapsed, sb=0 means expanded
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (sidebarFromUrl === '1') return true
    if (sidebarFromUrl === '0') return false
    return defaultCollapsed
  })

  // Derive state from URL params
  const selectedNamespace = namespaceFromUrl || 'All Namespaces'
  const selectedResource: ResourceKind | null =
    kindFromUrl && versionFromUrl
      ? {
          kind: kindFromUrl,
          apiGroup: groupFromUrl || '',
          apiVersion: versionFromUrl,
          count: 0,
        }
      : null

  // Update URL when namespace changes
  const handleNamespaceChange = useCallback(
    (namespace: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (namespace === 'All Namespaces') {
          next.delete(PARAM_NAMESPACE)
        } else {
          next.set(PARAM_NAMESPACE, namespace)
        }
        return next
      })
    },
    [setSearchParams]
  )

  // Update URL when resource selection changes
  // If not on dashboard, navigate to dashboard with resource params
  const handleResourceSelect = useCallback(
    (resource: ResourceKind) => {
      const params = new URLSearchParams()
      params.set(PARAM_KIND, resource.kind)
      params.set(PARAM_VERSION, resource.apiVersion)
      if (resource.apiGroup) {
        params.set(PARAM_GROUP, resource.apiGroup)
      }
      // Preserve namespace selection
      const currentNs = searchParams.get(PARAM_NAMESPACE)
      if (currentNs) {
        params.set(PARAM_NAMESPACE, currentNs)
      }
      // Preserve sidebar state (sb=1 collapsed, sb=0 expanded)
      params.set(PARAM_SIDEBAR, sidebarCollapsed ? '1' : '0')

      // If not on dashboard, navigate to dashboard
      if (!location.pathname.startsWith('/dashboard')) {
        navigate(`/dashboard?${params.toString()}`)
      } else {
        setSearchParams(params)
      }
    },
    [searchParams, location.pathname, navigate, setSearchParams, sidebarCollapsed]
  )

  const contextValue: DashboardContextValue = {
    selectedNamespace,
    setSelectedNamespace: handleNamespaceChange,
    selectedResource,
    setSelectedResource: handleResourceSelect,
    hasResources,
    sidebarCollapsed,
  }

  return (
    <DashboardContext.Provider value={contextValue}>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="bg-header-bg border-b border-border px-3 sm:px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity"
            >
              <img
                src="/logo.jpeg"
                alt="DevOps AI Toolkit"
                className="h-7 sm:h-8 w-auto rounded"
              />
              <span className="text-xs sm:text-sm font-medium text-primary">
                DevOps AI Toolkit
              </span>
            </Link>
            {showSidebar && (
              <>
                <span className="text-border">|</span>
                <span className="text-sm font-medium text-foreground">Dashboard</span>
              </>
            )}
          </div>
          {showSidebar && (
            <NamespaceSelector
              value={selectedNamespace}
              onChange={handleNamespaceChange}
            />
          )}
        </header>

        {/* Main content with sidebar */}
        <div className="flex-1 flex overflow-hidden">
          {showSidebar && (
            <DashboardSidebar
              selectedResource={selectedResource}
              onSelectResource={handleResourceSelect}
              namespace={selectedNamespace}
              isCollapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
              onResourcesLoaded={setHasResources}
            />
          )}

          {/* Content area - renders child routes */}
          <main className={`flex-1 overflow-auto ${!showSidebar ? 'px-3 sm:px-4 md:px-6 py-3 sm:py-4' : ''}`}>
            <Outlet />
          </main>
        </div>
      </div>
    </DashboardContext.Provider>
  )
}
