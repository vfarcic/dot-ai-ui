import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { Link, Outlet, useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { DashboardSidebar } from './DashboardSidebar'
import { NamespaceSelector } from './NamespaceSelector'
import { SearchInput } from './SearchInput'
import { ActionBar } from './ActionBar'
import { useAuth } from '../../auth/AuthContext'
import type { ResourceKind } from '../../api/dashboard'
import type { SearchScope } from '../../api/knowledge'

// URL param keys (short for cleaner URLs)
const PARAM_NAMESPACE = 'ns'
const PARAM_KIND = 'kind'
const PARAM_GROUP = 'group'
const PARAM_VERSION = 'version'
const PARAM_SIDEBAR = 'sb' // '1' = collapsed
const PARAM_SEARCH = 'q' // search query
const PARAM_SCOPE = 'scope' // 'resources' | 'knowledge' (omitted = 'both')

// Context for sharing dashboard state with child components
interface DashboardContextValue {
  selectedNamespace: string
  setSelectedNamespace: (ns: string) => void
  selectedResource: ResourceKind | null
  setSelectedResource: (resource: ResourceKind) => void
  hasResources: boolean | null
  availableKinds: ResourceKind[]
  sidebarCollapsed: boolean
  searchQuery: string
  setSearchQuery: (query: string) => void
  searchScope: SearchScope
  setSearchScope: (scope: SearchScope) => void
  searchResultKinds: ResourceKind[] | null
  setSearchResultKinds: (kinds: ResourceKind[] | null) => void
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

export function useDashboardContext() {
  const context = useContext(DashboardContext)
  if (!context) {
    throw new Error('useDashboardContext must be used within SharedDashboardLayout')
  }
  return context
}

function UserMenu() {
  const { authMode, userEmail, logout } = useAuth()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
      >
        {authMode === 'oauth' && userEmail ? (
          <span className="truncate max-w-[150px]">{userEmail}</span>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-muted border border-border rounded-md shadow-lg py-1 min-w-[140px]">
            {authMode === 'oauth' && userEmail && (
              <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border truncate">
                {userEmail}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                if (authMode === 'oauth') {
                  fetch('/auth/logout').catch(() => {})
                }
                logout()
              }}
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-background transition-colors"
            >
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  )
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
  const [availableKinds, setAvailableKinds] = useState<ResourceKind[]>([])
  const [searchResultKinds, setSearchResultKinds] = useState<ResourceKind[] | null>(null)
  const navigate = useNavigate()
  const location = useLocation()

  // Read state from URL params
  const namespaceFromUrl = searchParams.get(PARAM_NAMESPACE)
  const kindFromUrl = searchParams.get(PARAM_KIND)
  const groupFromUrl = searchParams.get(PARAM_GROUP)
  const versionFromUrl = searchParams.get(PARAM_VERSION)
  const sidebarFromUrl = searchParams.get(PARAM_SIDEBAR)
  const searchFromUrl = searchParams.get(PARAM_SEARCH)

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
  const searchQuery = searchFromUrl || ''
  const scopeFromUrl = searchParams.get(PARAM_SCOPE)
  const searchScope: SearchScope =
    scopeFromUrl === 'resources' || scopeFromUrl === 'knowledge'
      ? scopeFromUrl
      : 'both'

  // Update URL when search query changes
  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (query) {
          next.set(PARAM_SEARCH, query)
        } else {
          next.delete(PARAM_SEARCH)
        }
        return next
      })
    },
    [setSearchParams]
  )

  // Update URL when search scope changes
  const handleScopeChange = useCallback(
    (scope: SearchScope) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (scope === 'both') {
          next.delete(PARAM_SCOPE)
        } else {
          next.set(PARAM_SCOPE, scope)
        }
        return next
      })
    },
    [setSearchParams]
  )

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
      // Start with fresh params (implicitly clears search query and scope)
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

  // Clear resource selection (show all resources view)
  const handleClearSelection = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete(PARAM_KIND)
      next.delete(PARAM_VERSION)
      next.delete(PARAM_GROUP)
      return next
    })
  }, [setSearchParams])

  const contextValue: DashboardContextValue = {
    selectedNamespace,
    setSelectedNamespace: handleNamespaceChange,
    selectedResource,
    setSelectedResource: handleResourceSelect,
    hasResources,
    availableKinds,
    sidebarCollapsed,
    searchQuery,
    setSearchQuery: handleSearchChange,
    searchScope,
    setSearchScope: handleScopeChange,
    searchResultKinds,
    setSearchResultKinds,
  }

  return (
    <DashboardContext.Provider value={contextValue}>
      <div className="h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="bg-header-bg border-b border-border px-3 sm:px-4 py-2 flex items-center justify-between gap-4">
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
              <span className="text-xs sm:text-sm font-medium text-primary hidden sm:inline">
                DevOps AI Toolkit
              </span>
            </Link>
          </div>
          {showSidebar && (
            <div className="flex items-center gap-3 flex-1 max-w-3xl">
              <NamespaceSelector
                value={selectedNamespace}
                onChange={handleNamespaceChange}
              />
              <SearchInput
                value={searchQuery}
                onSubmit={handleSearchChange}
                scope={searchScope}
                onScopeChange={handleScopeChange}
                className="flex-1"
              />
            </div>
          )}
          <UserMenu />
        </header>

        {/* Main content with sidebar */}
        <div className="flex-1 flex overflow-hidden">
          {showSidebar && (
            <DashboardSidebar
              selectedResource={selectedResource}
              onSelectResource={handleResourceSelect}
              onClearSelection={handleClearSelection}
              namespace={selectedNamespace}
              isCollapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
              onResourcesLoaded={setHasResources}
              onKindsLoaded={setAvailableKinds}
              searchResultKinds={searchResultKinds}
            />
          )}

          {/* Content area - renders child routes */}
          <main className={`flex-1 overflow-auto ${!showSidebar ? 'px-3 sm:px-4 md:px-6 py-3 sm:py-4' : ''}`}>
            <Outlet />
          </main>
        </div>

        {/* Action Bar - fixed at bottom */}
        <ActionBar />
      </div>
    </DashboardContext.Provider>
  )
}
