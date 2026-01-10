import { useState, useCallback, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { DashboardSidebar } from './DashboardSidebar'
import { NamespaceSelector } from './NamespaceSelector'
import { ResourceList } from './ResourceList'
import { ExpandableDescription } from './ExpandableDescription'
import {
  getCapabilities,
  getBuiltinResourceColumns,
  DEFAULT_COLUMNS,
  type ResourceKind,
  type ResourceCapabilities,
} from '../../api/dashboard'

// URL param keys (short for cleaner URLs)
const PARAM_NAMESPACE = 'ns'
const PARAM_KIND = 'kind'
const PARAM_GROUP = 'group'
const PARAM_VERSION = 'version'

export function DashboardLayout() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [hasResources, setHasResources] = useState<boolean | null>(null) // null = loading

  // Read initial state from URL params
  const namespaceFromUrl = searchParams.get(PARAM_NAMESPACE)
  const kindFromUrl = searchParams.get(PARAM_KIND)
  const groupFromUrl = searchParams.get(PARAM_GROUP)
  const versionFromUrl = searchParams.get(PARAM_VERSION)

  // Derive state from URL params
  const selectedNamespace = namespaceFromUrl || 'All Namespaces'
  const selectedResource: ResourceKind | null = kindFromUrl && versionFromUrl
    ? {
        kind: kindFromUrl,
        apiGroup: groupFromUrl || '',
        apiVersion: versionFromUrl,
        count: 0, // Count not needed for selection, will be fetched
      }
    : null

  // Capabilities state for resource description and printer columns
  const [capabilities, setCapabilities] = useState<ResourceCapabilities | null>(null)
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(false)

  // Fetch capabilities when selected resource changes
  useEffect(() => {
    if (!selectedResource) {
      setCapabilities(null)
      setCapabilitiesLoading(false)
      return
    }

    const fetchCapabilities = async () => {
      setCapabilitiesLoading(true)

      // Build apiVersion: may already be full (e.g., "postgresql.cnpg.io/v1") or just version (e.g., "v1")
      const apiVersion = selectedResource.apiVersion.includes('/')
        ? selectedResource.apiVersion
        : selectedResource.apiGroup
          ? `${selectedResource.apiGroup}/${selectedResource.apiVersion}`
          : selectedResource.apiVersion

      // Check for hardcoded built-in resource columns first
      const builtinColumns = getBuiltinResourceColumns(
        selectedResource.kind,
        selectedResource.apiVersion
      )

      if (builtinColumns) {
        // For built-in resources, we still fetch from MCP for description/useCase
        // but use hardcoded columns
        const result = await getCapabilities({
          kind: selectedResource.kind,
          apiVersion,
        })

        setCapabilities({
          kind: selectedResource.kind,
          apiVersion,
          printerColumns: builtinColumns,
          description: result.data?.description,
          useCase: result.data?.useCase,
        })
        setCapabilitiesLoading(false)
        return
      }

      // Fetch from MCP for CRDs and other resources
      const result = await getCapabilities({
        kind: selectedResource.kind,
        apiVersion,
      })

      if (result.error || !result.data) {
        // MCP failed - use default fallback columns
        setCapabilities({
          kind: selectedResource.kind,
          apiVersion,
          printerColumns: DEFAULT_COLUMNS,
        })
      } else {
        // Filter out columns with empty jsonPath or .spec references
        const validColumns = (result.data.printerColumns || []).filter((col) => {
          if (!col.jsonPath || col.jsonPath.trim() === '') return false
          if (col.jsonPath.startsWith('.spec')) return false
          return true
        })

        setCapabilities({
          ...result.data,
          printerColumns: validColumns.length > 0 ? validColumns : DEFAULT_COLUMNS,
        })
      }
      setCapabilitiesLoading(false)
    }

    fetchCapabilities()
  }, [selectedResource?.kind, selectedResource?.apiGroup, selectedResource?.apiVersion])

  // Update URL when namespace changes
  const handleNamespaceChange = useCallback((namespace: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (namespace === 'All Namespaces') {
        next.delete(PARAM_NAMESPACE)
      } else {
        next.set(PARAM_NAMESPACE, namespace)
      }
      return next
    })
  }, [setSearchParams])

  // Update URL when resource selection changes
  const handleResourceSelect = useCallback((resource: ResourceKind) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set(PARAM_KIND, resource.kind)
      next.set(PARAM_VERSION, resource.apiVersion)
      if (resource.apiGroup) {
        next.set(PARAM_GROUP, resource.apiGroup)
      } else {
        next.delete(PARAM_GROUP)
      }
      return next
    })
  }, [setSearchParams])

  return (
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
          <span className="text-border">|</span>
          <span className="text-sm font-medium text-foreground">Dashboard</span>
        </div>
        <NamespaceSelector
          value={selectedNamespace}
          onChange={handleNamespaceChange}
        />
      </header>

      {/* Main content with sidebar */}
      <div className="flex-1 flex overflow-hidden">
        <DashboardSidebar
          selectedResource={selectedResource}
          onSelectResource={handleResourceSelect}
          namespace={selectedNamespace}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          onResourcesLoaded={setHasResources}
        />

        {/* Content area */}
        <main className="flex-1 overflow-auto">
          {selectedResource ? (
            <>
              {/* Content header */}
              <div className="border-b border-border px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="overflow-hidden">
                    <h1 className="text-xl font-semibold text-foreground">
                      {selectedResource.kind}
                      {selectedResource.apiGroup && (
                        <span className="text-sm font-normal text-muted-foreground ml-2">
                          ({selectedResource.apiGroup})
                        </span>
                      )}
                    </h1>
                    <div className="mt-1">
                      <ExpandableDescription
                        description={capabilities?.description}
                        useCase={capabilities?.useCase}
                        loading={capabilitiesLoading}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Resource list */}
              <div className="p-6">
                <div className="bg-muted/30 border border-border rounded-lg overflow-hidden">
                  <ResourceList
                    resourceKind={selectedResource}
                    namespace={selectedNamespace}
                    onNamespaceClick={handleNamespaceChange}
                    capabilities={capabilities}
                    capabilitiesLoading={capabilitiesLoading}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <svg
                  className="w-16 h-16 mx-auto mb-4 opacity-50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
                {hasResources === false ? (
                  <>
                    <p className="text-lg text-yellow-500 font-medium mb-2">No resources indexed</p>
                    <p className="text-sm mb-4 max-w-md">
                      The dot-ai-controller may not be running or hasn't synced cluster resources yet.
                    </p>
                    <a
                      href="https://devopstoolkit.ai/docs/controller/resource-sync-guide"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      View resource sync guide →
                    </a>
                  </>
                ) : (
                  <p className="text-lg">Select a resource type from the sidebar</p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
