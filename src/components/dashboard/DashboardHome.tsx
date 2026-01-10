import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDashboardContext } from './SharedDashboardLayout'
import { ResourceList } from './ResourceList'
import { ExpandableDescription } from './ExpandableDescription'
import { LoadingSpinner } from '../LoadingSpinner'
import { ErrorDisplay } from '../ErrorDisplay'
import { TabContainer } from '../TabContainer'
import { InsightsPanel } from '../InsightsPanel'
import { VisualizationRenderer } from '../renderers'
import {
  getCapabilities,
  getBuiltinResourceColumns,
  DEFAULT_COLUMNS,
  type ResourceCapabilities,
} from '../../api/dashboard'
import { queryCluster, type QueryResponse } from '../../api/query'
import { APIError } from '../../api/client'

export function DashboardHome() {
  const navigate = useNavigate()
  const {
    selectedNamespace,
    setSelectedNamespace,
    selectedResource,
    hasResources,
    sidebarCollapsed,
  } = useDashboardContext()

  // Capabilities state for resource description and printer columns
  const [capabilities, setCapabilities] = useState<ResourceCapabilities | null>(null)
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(false)

  // Query state for "Analyze Cluster Health"
  const [queryLoading, setQueryLoading] = useState(false)
  const [queryResult, setQueryResult] = useState<QueryResponse | null>(null)
  const [queryError, setQueryError] = useState<APIError | null>(null)

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

  // Handle "Analyze Cluster Health" button click
  const handleAnalyzeCluster = async () => {
    setQueryLoading(true)
    setQueryError(null)
    setQueryResult(null)

    try {
      const result = await queryCluster('Analyze cluster health and show resource status overview')
      // If we got a sessionId, navigate to the visualization page for URL caching
      if (result.sessionId) {
        // Preserve sidebar state in URL (sb=1 collapsed, sb=0 expanded)
        const sidebarParam = sidebarCollapsed ? '?sb=1' : '?sb=0'
        navigate(`/v/${result.sessionId}${sidebarParam}`)
      } else {
        // Fallback: show results inline if no sessionId
        setQueryResult(result)
      }
    } catch (err) {
      if (err instanceof APIError) {
        setQueryError(err)
      } else {
        setQueryError(new APIError('An unexpected error occurred', 0, 'Unknown'))
      }
    } finally {
      setQueryLoading(false)
    }
  }

  // Handle retry for query errors
  const handleRetry = () => {
    handleAnalyzeCluster()
  }

  // Clear query results (to go back to initial state)
  const handleClearResults = () => {
    setQueryResult(null)
    setQueryError(null)
  }

  // If a resource is selected, show the resource list
  if (selectedResource) {
    return (
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
              onNamespaceClick={setSelectedNamespace}
              capabilities={capabilities}
              capabilitiesLoading={capabilitiesLoading}
            />
          </div>
        </div>
      </>
    )
  }

  // No resource selected - show dashboard home with "Analyze Cluster Health" button

  // Show query results if available - using same components as Visualization page
  if (queryResult) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <h1 className="text-base sm:text-lg font-semibold leading-tight">{queryResult.title}</h1>
          <button
            onClick={handleClearResults}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-md transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear
          </button>
        </div>

        <InsightsPanel sessionId={queryResult.sessionId} insights={queryResult.insights} />

        {queryResult.visualizations && queryResult.visualizations.length > 0 && (
          <TabContainer
            visualizations={queryResult.visualizations}
            renderContent={(viz) => <VisualizationRenderer visualization={viz} />}
          />
        )}
      </div>
    )
  }

  // Show error if query failed
  if (queryError) {
    return (
      <div className="p-6">
        <ErrorDisplay
          type={queryError.errorType}
          message={queryError.message}
          onRetry={queryError.isRetryable ? handleRetry : undefined}
        />
        <div className="mt-4 text-center">
          <button
            onClick={handleClearResults}
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  // Show loading state
  if (queryLoading) {
    return (
      <div className="flex-1 flex items-center pt-16 sm:pt-24 flex-col">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-muted-foreground">Analyzing cluster health...</p>
          <p className="mt-1 text-sm text-muted-foreground/70">This may take a minute</p>
        </div>
      </div>
    )
  }

  // Default state - show "Analyze Cluster Health" button
  return (
    <div className="flex-1 flex items-center pt-16 sm:pt-24 flex-col">
      <div className="text-center">
        {hasResources === false ? (
          // No resources indexed state
          <>
            <svg
              className="w-16 h-16 mx-auto mb-4 opacity-50 text-muted-foreground"
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
            <p className="text-lg text-yellow-500 font-medium mb-2">No resources indexed</p>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
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
          // Resources available - show AI analysis button
          <>
            <svg
              className="w-20 h-20 mx-auto mb-6 text-primary/60"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Kubernetes Dashboard
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Select a resource type from the sidebar to browse your cluster,
              or let AI analyze your cluster health.
            </p>
            <button
              onClick={handleAnalyzeCluster}
              className="inline-flex items-center gap-2 px-6 py-3 text-base font-medium text-black bg-yellow-400 hover:bg-yellow-500 rounded-lg transition-colors shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Analyze Cluster Health
            </button>
            <p className="mt-3 text-xs text-muted-foreground">
              Uses AI to analyze resources and provide insights
            </p>
          </>
        )}
      </div>
    </div>
  )
}
