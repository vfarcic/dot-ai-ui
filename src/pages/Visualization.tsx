import { useCallback, useEffect, useState, useRef } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { TabContainer } from '@/components/TabContainer'
import { InsightsPanel } from '@/components/InsightsPanel'
import { ErrorDisplay } from '@/components/ErrorDisplay'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { VisualizationRenderer } from '@/components/renderers'
import { InfoRenderer, REMEDIATE_TEMPLATE, OPERATE_TEMPLATE } from '@/components/InfoRenderer'
import { ActionsPanel } from '@/components/ActionsPanel'
import { ResultsPanel } from '@/components/ResultsPanel'
import { getVisualization, APIError } from '@/api'
import { executeRemediation, getRemediateSession, type RemediateResponse } from '@/api/remediate'
import { executeOperation, getOperateSession, type OperateResponse } from '@/api/operate'
import type { VisualizationResponse } from '@/types'

/**
 * Check if session is a remediate session based on ID prefix
 */
function isRemediateSession(sessionId: string): boolean {
  return sessionId.startsWith('rem-')
}

/**
 * Check if session is an operate session based on ID prefix
 */
function isOperateSession(sessionId: string): boolean {
  return sessionId.startsWith('opr-')
}

// Navigation state type for tool data passed from ActionBar
interface NavigationState {
  remediateData?: RemediateResponse
  operateData?: OperateResponse
}

export function Visualization() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const location = useLocation()

  // Get tool data from navigation state (passed from ActionBar)
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
  const [isRemediateExecuting, setIsRemediateExecuting] = useState(false)

  // Operate workflow state - initialize from navigation state if available
  const [operateData, setOperateData] = useState<OperateResponse | null>(
    navigationState?.operateData || null
  )
  const [operateError, setOperateError] = useState<string | null>(null)
  const [isOperateLoading, setIsOperateLoading] = useState(false)
  const [isOperateExecuting, setIsOperateExecuting] = useState(false)

  // Track which session we've fetched to prevent duplicate fetches from React StrictMode
  const fetchedSessionRef = useRef<string | null>(null)

  // Reset state when navigating between sessions
  // useState initial values only apply on mount, so we need this for re-navigation
  useEffect(() => {
    setRemediateData(navigationState?.remediateData || null)
    setOperateData(navigationState?.operateData || null)
    setRemediateError(null)
    setOperateError(null)
    setVizData(null)
    setVizError(null)
    setIsVizLoading(true)
    // Reset fetch ref to allow fetching for new session
    fetchedSessionRef.current = null
  }, [sessionId, navigationState?.remediateData, navigationState?.operateData])

  const isRemediate = sessionId ? isRemediateSession(sessionId) : false
  const isOperate = sessionId ? isOperateSession(sessionId) : false

  // Fetch visualization data
  const fetchVizData = useCallback(
    async (reload = false) => {
      if (!sessionId) return

      try {
        if (reload) {
          // Clear existing viz data and show loading state for reloads
          setVizData(null)
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
  // Note: intentionally NOT including remediateData in deps to prevent re-fetch loops
  const fetchRemediateData = useCallback(async () => {
    if (!sessionId || !isRemediate) return

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isRemediate])

  // Handle remediate execution choice
  const handleRemediateExecute = useCallback(
    async (choiceId: number) => {
      if (!sessionId || !remediateData) return

      setIsRemediateExecuting(true)
      setRemediateError(null)

      try {
        const result = await executeRemediation(sessionId, choiceId)
        setRemediateData(result)

        // Refresh visualization to get updated data after execution
        await fetchVizData(true)
      } catch (err) {
        setRemediateError(err instanceof Error ? err.message : 'Execution failed')
      } finally {
        setIsRemediateExecuting(false)
      }
    },
    [sessionId, remediateData, fetchVizData]
  )

  // Fetch operate data (for page refresh/shared URLs)
  const fetchOperateData = useCallback(async () => {
    if (!sessionId || !isOperate) return

    setIsOperateLoading(true)
    setOperateError(null)

    try {
      const data = await getOperateSession(sessionId)
      if (data) {
        setOperateData(data)
      } else {
        setOperateError('Session not found or expired. Please re-submit the operation from the dashboard.')
      }
    } catch (err) {
      setOperateError(err instanceof Error ? err.message : 'Failed to load session data')
    } finally {
      setIsOperateLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isOperate])

  // Handle operate execution choice
  const handleOperateExecute = useCallback(
    async (choiceId: number) => {
      if (!sessionId || !operateData) return

      setIsOperateExecuting(true)
      setOperateError(null)

      try {
        const result = await executeOperation(sessionId, choiceId)
        // Merge result with existing data to preserve analysis
        setOperateData({
          ...operateData,
          ...result,
          // Keep original analysis if execution response doesn't include it
          analysis: result.analysis || operateData.analysis,
        })

        // Refresh visualization to get updated data after execution
        await fetchVizData(true)
      } catch (err) {
        setOperateError(err instanceof Error ? err.message : 'Execution failed')
      } finally {
        setIsOperateExecuting(false)
      }
    },
    [sessionId, operateData, fetchVizData]
  )

  const handleReload = useCallback(() => {
    fetchVizData(true)
  }, [fetchVizData])

  // Initial fetch - runs once on mount
  // Uses ref to prevent duplicate fetches from React StrictMode double-mounting
  useEffect(() => {
    if (!sessionId) {
      setVizError(new APIError('No session ID provided', 400, 'Bad Request'))
      setIsVizLoading(false)
      return
    }

    // Skip if we've already fetched for this session (prevents StrictMode double-fetch)
    if (fetchedSessionRef.current === sessionId) {
      return
    }
    fetchedSessionRef.current = sessionId

    fetchVizData()
    // Only fetch remediate data if we don't already have it from navigation state
    if (isRemediate && !navigationState?.remediateData) {
      fetchRemediateData()
    }
    // Only fetch operate data if we don't already have it from navigation state
    if (isOperate && !navigationState?.operateData) {
      fetchOperateData()
    }
  }, [sessionId, isRemediate, isOperate, navigationState?.remediateData, navigationState?.operateData, fetchVizData, fetchRemediateData, fetchOperateData])

  // Check if we have any tool data to show
  const hasToolData = remediateData || operateData

  // Loading state
  if (isVizLoading && !hasToolData) {
    return <LoadingSpinner />
  }

  // Error state
  if (vizError && !hasToolData) {
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
  const hasOperateWorkflow = operateData && operateData.status === 'awaiting_user_approval'
  const hasOperateResults = operateData && operateData.status === 'success' && operateData.execution?.results

  // Title - prefer tool data title patterns
  const title = vizData?.title || (remediateData ? 'Remediation Analysis' : operateData ? 'Operation Proposal' : 'Visualization')

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

      {/* Section 1a: Information (Remediate analysis) */}
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

              {/* Actions (execution buttons) */}
              {hasRemediateWorkflow && remediateData.executionChoices && (
                <ActionsPanel
                  choices={remediateData.executionChoices.filter(c => c.id === 1)}
                  onSelect={handleRemediateExecute}
                  isLoading={isRemediateExecuting}
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

      {/* Section 1b: Information (Operate proposal) */}
      {operateData && (
        <div className="mb-4 p-4 rounded-lg border border-border bg-card">
          {isOperateLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <LoadingSpinner />
              <span>Loading operation proposal...</span>
            </div>
          ) : (
            <>
              <InfoRenderer
                template={OPERATE_TEMPLATE}
                data={operateData as unknown as Record<string, unknown>}
              />

              {/* Error message */}
              {operateError && (
                <div className="mt-3 p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {operateError}
                </div>
              )}

              {/* Actions (execution buttons) */}
              {hasOperateWorkflow && (
                <ActionsPanel
                  choices={[{ id: 1, label: 'Execute automatically', description: 'Apply the proposed changes to the cluster' }]}
                  onSelect={handleOperateExecute}
                  isLoading={isOperateExecuting}
                  hint="Or use the Copy buttons above to execute commands manually"
                />
              )}

              {/* Results after execution */}
              {hasOperateResults && operateData.execution?.results && (
                <ResultsPanel
                  results={operateData.execution.results.map(r => ({
                    action: r.command,
                    success: r.success,
                    output: r.output,
                  }))}
                  validation={{ success: true, summary: operateData.execution.validation || '' }}
                  message={operateData.message}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Section 2: Insights (skip for tool sessions and when no visualizations - shown inline instead) */}
      {!isRemediate && !isOperate && hasVisualization && vizData?.insights && vizData.insights.length > 0 && (
        <InsightsPanel sessionId={sessionId!} insights={vizData.insights} />
      )}

      {/* Section 3: Visualizations */}
      {hasVisualization ? (
        <div className="relative">
          {/* Loading overlay when refreshing visualizations */}
          {isReloading && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10 rounded-lg">
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                <span>Refreshing visualizations...</span>
              </div>
            </div>
          )}
          <TabContainer
            visualizations={vizData!.visualizations}
            renderContent={(viz) => <VisualizationRenderer visualization={viz} />}
          />
        </div>
      ) : isVizLoading || isReloading ? (
        <div className="py-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
            <span>{isReloading ? 'Refreshing visualizations...' : 'Loading visualizations...'}</span>
          </div>
        </div>
      ) : (
        !hasToolData && (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center max-w-lg">
              {vizData?.insights && vizData.insights.length > 0 ? (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <svg className="w-6 h-6 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-lg font-medium text-amber-400">
                      {vizData.title || 'Notice'}
                    </span>
                  </div>
                  <div className="text-sm text-foreground text-left space-y-2">
                    {vizData.insights.map((insight, idx) => (
                      <p key={idx}>{insight}</p>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">No visualizations available</div>
              )}
            </div>
          </div>
        )
      )}
    </div>
  )
}
