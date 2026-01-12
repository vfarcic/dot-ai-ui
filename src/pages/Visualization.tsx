import { useCallback, useEffect, useState } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { TabContainer } from '@/components/TabContainer'
import { InsightsPanel } from '@/components/InsightsPanel'
import { ErrorDisplay } from '@/components/ErrorDisplay'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { VisualizationRenderer } from '@/components/renderers'
import { InfoRenderer, REMEDIATE_TEMPLATE } from '@/components/InfoRenderer'
import { ActionsPanel } from '@/components/ActionsPanel'
import { ResultsPanel } from '@/components/ResultsPanel'
import { getVisualization, APIError } from '@/api'
import { executeRemediation, getRemediateSession, type RemediateResponse } from '@/api/remediate'
import type { VisualizationResponse } from '@/types'

/**
 * Check if session is a remediate session based on ID prefix
 */
function isRemediateSession(sessionId: string): boolean {
  return sessionId.startsWith('rem-')
}

// Navigation state type for remediate data passed from ActionBar
interface NavigationState {
  remediateData?: RemediateResponse
}

export function Visualization() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const location = useLocation()

  // Get remediate data from navigation state (passed from ActionBar)
  const navigationState = location.state as NavigationState | null

  // Visualization state
  const [vizData, setVizData] = useState<VisualizationResponse | null>(null)
  const [vizError, setVizError] = useState<APIError | null>(null)
  const [isVizLoading, setIsVizLoading] = useState(true)
  const [isReloading, setIsReloading] = useState(false)

  // Remediate workflow state - initialize from navigation state if available
  const [remediateData, setRemediateData] = useState<RemediateResponse | null>(
    navigationState?.remediateData || null
  )
  const [remediateError, setRemediateError] = useState<string | null>(null)
  const [isRemediateLoading, setIsRemediateLoading] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)

  const isRemediate = sessionId ? isRemediateSession(sessionId) : false

  // Fetch visualization data
  const fetchVizData = useCallback(
    async (reload = false) => {
      if (!sessionId) return

      try {
        if (reload) {
          setIsReloading(true)
        } else {
          setIsVizLoading(true)
        }
        setVizError(null)
        const response = await getVisualization(sessionId, { reload })
        setVizData(response)
      } catch (err) {
        if (err instanceof APIError) {
          setVizError(err)
        } else {
          setVizError(new APIError('An unexpected error occurred', 0, 'Unknown'))
        }
      } finally {
        setIsVizLoading(false)
        setIsReloading(false)
      }
    },
    [sessionId]
  )

  // Fetch remediate data (for page refresh/shared URLs)
  // Uses cached session data from MCP
  const fetchRemediateData = useCallback(async () => {
    if (!sessionId || !isRemediate) return

    // If we already have data from navigation state, don't fetch
    if (remediateData) return

    setIsRemediateLoading(true)
    setRemediateError(null)

    try {
      const data = await getRemediateSession(sessionId)
      if (data) {
        setRemediateData(data)
      } else {
        setRemediateError('Session not found or expired. Please re-analyze the issue from the dashboard.')
      }
    } catch (err) {
      setRemediateError(err instanceof Error ? err.message : 'Failed to load session data')
    } finally {
      setIsRemediateLoading(false)
    }
  }, [sessionId, isRemediate, remediateData])

  // Handle execution choice
  const handleExecuteChoice = useCallback(
    async (choiceId: number) => {
      if (!sessionId || !remediateData) return

      setIsExecuting(true)
      setRemediateError(null)

      try {
        const result = await executeRemediation(sessionId, choiceId)
        setRemediateData(result)

        // Refresh visualization to get updated data
        fetchVizData(true)
      } catch (err) {
        setRemediateError(err instanceof Error ? err.message : 'Execution failed')
      } finally {
        setIsExecuting(false)
      }
    },
    [sessionId, remediateData, fetchVizData]
  )

  const handleReload = useCallback(() => {
    fetchVizData(true)
  }, [fetchVizData])

  // Initial fetch
  useEffect(() => {
    if (!sessionId) {
      setVizError(new APIError('No session ID provided', 400, 'Bad Request'))
      setIsVizLoading(false)
      return
    }

    fetchVizData()
    if (isRemediate) {
      fetchRemediateData()
    }
  }, [sessionId, fetchVizData, fetchRemediateData, isRemediate])

  // Loading state
  if (isVizLoading && !remediateData) {
    return <LoadingSpinner />
  }

  // Error state
  if (vizError && !remediateData) {
    return (
      <ErrorDisplay
        type={vizError.errorType}
        message={vizError.message}
        sessionId={sessionId}
        onRetry={vizError.isRetryable ? () => fetchVizData() : undefined}
      />
    )
  }

  // Determine what to show
  const hasVisualization = vizData && vizData.visualizations && vizData.visualizations.length > 0
  const hasRemediateWorkflow = remediateData && remediateData.status === 'awaiting_user_approval'
  const hasRemediateResults = remediateData && remediateData.status === 'success' && remediateData.results

  // Title - prefer remediate data title pattern
  const title = vizData?.title || (remediateData ? 'Remediation Analysis' : 'Visualization')

  return (
    <div className="w-full p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h1 className="text-base sm:text-lg font-semibold leading-tight">{title}</h1>
        <button
          onClick={handleReload}
          disabled={isReloading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-black bg-yellow-400 hover:bg-yellow-500 rounded-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          title="Reload visualizations (invalidate cache)"
        >
          <svg
            className={`w-4 h-4 ${isReloading ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {isReloading ? 'Reloading...' : 'Reload Visualizations'}
        </button>
      </div>

      {/* Section 1: Information (Remediate analysis) */}
      {remediateData && (
        <div className="mb-4 p-4 rounded-lg border border-border bg-card">
          {isRemediateLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <LoadingSpinner />
              <span>Loading analysis...</span>
            </div>
          ) : (
            <>
              <InfoRenderer
                template={REMEDIATE_TEMPLATE}
                data={remediateData as unknown as Record<string, unknown>}
              />

              {/* Error message */}
              {remediateError && (
                <div className="mt-3 p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {remediateError}
                </div>
              )}

              {/* Section 4: Actions (execution buttons) */}
              {hasRemediateWorkflow && remediateData.executionChoices && (
                <ActionsPanel
                  choices={remediateData.executionChoices.filter(c => c.id === 1)}
                  onSelect={handleExecuteChoice}
                  isLoading={isExecuting}
                  hint="Or use the Copy buttons above to execute commands manually"
                />
              )}

              {/* Results after execution */}
              {hasRemediateResults && remediateData.results && (
                <ResultsPanel
                  results={remediateData.results}
                  validation={remediateData.validation}
                  message={remediateData.message}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Section 2: Insights (skip for remediate - analysis already shows this) */}
      {!isRemediate && vizData?.insights && vizData.insights.length > 0 && (
        <InsightsPanel sessionId={sessionId!} insights={vizData.insights} />
      )}

      {/* Section 3: Visualizations */}
      {hasVisualization ? (
        <TabContainer
          visualizations={vizData!.visualizations}
          renderContent={(viz) => <VisualizationRenderer visualization={viz} />}
        />
      ) : isVizLoading ? (
        <div className="py-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
            <span>Loading visualizations...</span>
          </div>
        </div>
      ) : (
        !remediateData && (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center">
              <div className="text-muted-foreground mb-4">No visualizations available</div>
              {vizData && (
                <pre className="text-xs text-left bg-muted p-4 rounded overflow-auto max-w-xl">
                  {JSON.stringify(vizData, null, 2)}
                </pre>
              )}
            </div>
          </div>
        )
      )}
    </div>
  )
}
