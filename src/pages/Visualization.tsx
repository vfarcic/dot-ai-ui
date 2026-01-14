import { useCallback, useEffect, useState, useRef } from 'react'
import { useParams, useLocation, useSearchParams, useNavigate } from 'react-router-dom'
import { TabContainer } from '@/components/TabContainer'
import { InsightsPanel } from '@/components/InsightsPanel'
import { ErrorDisplay } from '@/components/ErrorDisplay'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { VisualizationRenderer } from '@/components/renderers'
import { InfoRenderer, REMEDIATE_TEMPLATE, OPERATE_TEMPLATE, RECOMMEND_SOLUTION_TEMPLATE } from '@/components/InfoRenderer'
import { ActionsPanel } from '@/components/ActionsPanel'
import { ResultsPanel } from '@/components/ResultsPanel'
import { SolutionSelector, QuestionForm, ManifestPreview } from '@/components/recommend'
import { getVisualization, APIError } from '@/api'
import { executeRemediation, getRemediateSession, type RemediateResponse } from '@/api/remediate'
import { executeOperation, getOperateSession, type OperateResponse } from '@/api/operate'
import {
  chooseSolution,
  answerQuestions,
  generateManifests,
  deployManifests,
  getRecommendSession,
  isQuestionsResponse,
  isManifestResponse,
  type RecommendSolutionsResponse,
  type RecommendDeployResponse,
  type Solution,
  type Question,
  type ManifestFile,
} from '@/api/recommend'
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

/**
 * Check if session is a recommend session based on ID prefix
 */
function isRecommendSession(sessionId: string): boolean {
  return sessionId.startsWith('sol-')
}

// Recommend workflow state passed through navigation (for solution selection)
interface RecommendWorkflowState {
  solutions: Solution[]
  organizationalContext?: RecommendSolutionsResponse['organizationalContext']
  selectedSolution: Solution
  questions: Question[]
  currentQuestionStage: string
  nextStage: string
}

// Navigation state type for tool data passed from ActionBar or internal navigation
interface NavigationState {
  remediateData?: RemediateResponse
  operateData?: OperateResponse
  recommendData?: RecommendSolutionsResponse
  recommendWorkflow?: RecommendWorkflowState
}

// Recommend workflow stage type
type RecommendStage = 'solutions' | 'questions' | 'manifests' | 'deployed'

// Valid stages for URL param
const VALID_STAGES: RecommendStage[] = ['solutions', 'questions', 'manifests', 'deployed']

/**
 * Parse stage from URL search params
 */
function parseStageFromUrl(searchParams: URLSearchParams): RecommendStage {
  const stage = searchParams.get('stage')
  if (stage && VALID_STAGES.includes(stage as RecommendStage)) {
    return stage as RecommendStage
  }
  return 'solutions'
}

export function Visualization() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Get tool data from navigation state (passed from ActionBar)
  const navigationState = location.state as NavigationState | null

  // Get initial stage from URL (for page refresh support)
  const initialStage = parseStageFromUrl(searchParams)

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

  // Recommend workflow state - multi-stage wizard
  // Initialize from URL param for page refresh support
  const [recommendStage, setRecommendStage] = useState<RecommendStage>(initialStage)
  const [solutions, setSolutions] = useState<Solution[]>(
    navigationState?.recommendData?.solutions || []
  )
  const [organizationalContext, setOrganizationalContext] = useState(
    navigationState?.recommendData?.organizationalContext
  )
  const [selectedSolution, setSelectedSolution] = useState<Solution | null>(null)
  const [currentQuestionStage, setCurrentQuestionStage] = useState<string | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [nextStage, setNextStage] = useState<string | null>(null)
  const [manifests, setManifests] = useState<ManifestFile[]>([])
  const [outputFormat, setOutputFormat] = useState<string>('')
  const [outputPath, setOutputPath] = useState<string>('')
  const [deployResponse, setDeployResponse] = useState<RecommendDeployResponse | null>(null)
  const [recommendError, setRecommendError] = useState<string | null>(null)
  const [isRecommendLoading, setIsRecommendLoading] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)

  // Track which session we've fetched to prevent duplicate fetches from React StrictMode
  const fetchedSessionRef = useRef<string | null>(null)
  // Track which session we've initialized to prevent re-running reset effect within same session
  const initializedSessionRef = useRef<string | null>(null)

  /**
   * Update recommend stage and sync to URL
   * This ensures the stage survives page refresh
   */
  const updateRecommendStage = useCallback((newStage: RecommendStage) => {
    setRecommendStage(newStage)
    // Update URL without triggering navigation
    const newSearchParams = new URLSearchParams(searchParams)
    if (newStage === 'solutions') {
      newSearchParams.delete('stage') // Default stage, no need in URL
    } else {
      newSearchParams.set('stage', newStage)
    }
    const newUrl = newSearchParams.toString()
      ? `${location.pathname}?${newSearchParams.toString()}`
      : location.pathname
    navigate(newUrl, { replace: true, state: location.state })
  }, [searchParams, location.pathname, location.state, navigate])

  // Reset state when navigating between sessions
  // useState initial values only apply on mount, so we need this for re-navigation
  // NOTE: We use initializedSessionRef to prevent re-running within the same session,
  // which would clear state set by user actions (like selecting a solution)
  useEffect(() => {
    // Skip if we've already initialized this session
    if (initializedSessionRef.current === sessionId) {
      return
    }
    initializedSessionRef.current = sessionId ?? null

    setRemediateData(navigationState?.remediateData || null)
    setOperateData(navigationState?.operateData || null)
    setRemediateError(null)
    setOperateError(null)
    setVizData(null)
    setVizError(null)
    setIsVizLoading(true)

    // Handle recommend state initialization
    const urlStage = parseStageFromUrl(searchParams)

    // If we have recommendWorkflow from internal navigation (solution selection),
    // use it to preserve the workflow state
    if (navigationState?.recommendWorkflow) {
      const workflow = navigationState.recommendWorkflow
      setRecommendStage(urlStage)
      setSolutions(workflow.solutions)
      setOrganizationalContext(workflow.organizationalContext)
      setSelectedSolution(workflow.selectedSolution)
      setQuestions(workflow.questions)
      setCurrentQuestionStage(workflow.currentQuestionStage)
      setNextStage(workflow.nextStage)
    } else if (navigationState?.recommendData) {
      // Initial navigation from ActionBar with solutions response
      setRecommendStage(urlStage)
      setSolutions(navigationState.recommendData.solutions || [])
      setOrganizationalContext(navigationState.recommendData.organizationalContext)
      setSelectedSolution(null)
      setCurrentQuestionStage(null)
      setQuestions([])
      setNextStage(null)
    } else {
      // Page refresh or direct URL access - will be restored from session
      setRecommendStage(urlStage)
      setSolutions([])
      setOrganizationalContext(undefined)
      setSelectedSolution(null)
      setCurrentQuestionStage(null)
      setQuestions([])
      setNextStage(null)
    }

    setManifests([])
    setOutputFormat('')
    setOutputPath('')
    setDeployResponse(null)
    setRecommendError(null)
    setIsDeploying(false)
    // Reset fetch ref to allow fetching for new session
    fetchedSessionRef.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, navigationState?.remediateData, navigationState?.operateData, navigationState?.recommendData, navigationState?.recommendWorkflow])

  const isRemediate = sessionId ? isRemediateSession(sessionId) : false
  const isOperate = sessionId ? isOperateSession(sessionId) : false
  const isRecommend = sessionId ? isRecommendSession(sessionId) : false

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

  // Fetch recommend data (for page refresh/shared URLs)
  const fetchRecommendData = useCallback(async () => {
    if (!sessionId || !isRecommend) return

    setIsRecommendLoading(true)
    setRecommendError(null)

    try {
      // For multi-session URLs (sol-1+sol-2+sol-3), extract just the first session ID
      // Each individual session contains allSolutions and organizationalContext
      const firstSessionId = sessionId.includes('+') ? sessionId.split('+')[0] : sessionId
      const data = await getRecommendSession(firstSessionId)
      if (data) {
        // Use session stage as source of truth
        // Only set stage if it's a valid UI stage (solutions, questions, manifests, deployed)
        if (data.stage === 'solutions' || data.stage === 'questions' || data.stage === 'manifests' || data.stage === 'deployed') {
          setRecommendStage(data.stage)
        }

        // Restore solutions list (preserved even after selection)
        if (data.solutions && data.solutions.length > 0) {
          setSolutions(data.solutions)
        }

        // Restore organizational context
        if (data.organizationalContext) {
          setOrganizationalContext(data.organizationalContext)
        }

        // Restore selected solution
        if (data.selectedSolution) {
          setSelectedSolution(data.selectedSolution)
        }

        // Restore questions for current stage (with pre-filled answers)
        if (data.questions && data.questions.length > 0) {
          setQuestions(data.questions)
          setCurrentQuestionStage(data.currentQuestionStage || null)
          setNextStage(data.nextStage || null)
        }

        // Restore manifests
        if (data.manifests && data.manifests.length > 0) {
          setManifests(data.manifests)
          setOutputFormat(data.outputFormat || 'raw')
          setOutputPath(data.outputPath || './manifests')
        }

        // Restore deployment results (create a response object from stored results)
        if (data.deployResults) {
          setDeployResponse({
            success: true,
            solutionId: data.selectedSolution?.solutionId || '',
            results: data.deployResults,
          })
        }
      } else {
        setRecommendError('Session not found or expired. Please start a new recommendation from the dashboard.')
      }
    } catch (err) {
      setRecommendError(err instanceof Error ? err.message : 'Failed to load session data')
    } finally {
      setIsRecommendLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isRecommend])

  // Handle solution selection
  const handleSolutionSelect = useCallback(
    async (solutionId: string) => {
      const solution = solutions.find((s) => s.solutionId === solutionId)
      if (!solution) return

      setSelectedSolution(solution)
      setIsRecommendLoading(true)
      setRecommendError(null)

      try {
        const result = await chooseSolution(solutionId)
        if (isQuestionsResponse(result)) {
          // Navigate to single solution URL for proper session restoration on refresh
          // This replaces the multi-session URL (sol-1+sol-2+sol-3) with single session URL (sol-1)
          const sidebarParam = searchParams.get('sb')
          const newSearchParams = new URLSearchParams()
          if (sidebarParam) newSearchParams.set('sb', sidebarParam)
          newSearchParams.set('stage', 'questions')

          // Pass recommend workflow state through navigation to preserve it after URL change
          // This includes the selected solution, questions, and organizational context
          navigate(`/v/${solutionId}?${newSearchParams.toString()}`, {
            replace: true,
            state: {
              recommendWorkflow: {
                solutions,
                organizationalContext,
                selectedSolution: solution,
                questions: result.questions,
                currentQuestionStage: result.currentStage,
                nextStage: result.nextStage,
              }
            }
          })
        }
      } catch (err) {
        setRecommendError(err instanceof Error ? err.message : 'Failed to select solution')
        setSelectedSolution(null)
      } finally {
        setIsRecommendLoading(false)
      }
    },
    [solutions, organizationalContext, searchParams, navigate]
  )

  // Handle question form submission
  const handleQuestionsSubmit = useCallback(
    async (answers: Record<string, string | number>) => {
      if (!selectedSolution || !currentQuestionStage) return

      setIsRecommendLoading(true)
      setRecommendError(null)

      try {
        const result = await answerQuestions(
          selectedSolution.solutionId,
          currentQuestionStage as 'required' | 'basic' | 'advanced' | 'open',
          answers
        )

        if (isQuestionsResponse(result)) {
          // More questions
          setQuestions(result.questions)
          setCurrentQuestionStage(result.currentStage)
          setNextStage(result.nextStage)
        } else if (isManifestResponse(result)) {
          // Manifests ready
          setManifests(result.files)
          setOutputFormat(result.outputFormat)
          setOutputPath(result.outputPath)
          updateRecommendStage('manifests')
        }
      } catch (err) {
        setRecommendError(err instanceof Error ? err.message : 'Failed to submit answers')
      } finally {
        setIsRecommendLoading(false)
      }
    },
    [selectedSolution, currentQuestionStage, updateRecommendStage]
  )

  // Handle manifest generation
  const handleGenerateManifests = useCallback(async () => {
    if (!selectedSolution) return

    setIsRecommendLoading(true)
    setRecommendError(null)

    try {
      const result = await generateManifests(selectedSolution.solutionId)
      setManifests(result.files)
      setOutputFormat(result.outputFormat)
      setOutputPath(result.outputPath)
      updateRecommendStage('manifests')
    } catch (err) {
      setRecommendError(err instanceof Error ? err.message : 'Failed to generate manifests')
    } finally {
      setIsRecommendLoading(false)
    }
  }, [selectedSolution, updateRecommendStage])

  // Handle deployment
  const handleDeploy = useCallback(async () => {
    console.log('[Deploy] Starting deployment, selectedSolution:', selectedSolution?.solutionId)
    if (!selectedSolution) {
      console.log('[Deploy] No selected solution, returning early')
      return
    }

    setIsDeploying(true)
    setRecommendError(null)

    try {
      console.log('[Deploy] Calling deployManifests...')
      const result = await deployManifests(selectedSolution.solutionId)
      console.log('[Deploy] Got result:', result)
      setDeployResponse(result)
      // Don't use updateRecommendStage for deployed - just set state directly
      // Using navigate() can cause state loss issues at this final stage
      setRecommendStage('deployed')
      console.log('[Deploy] Stage set to deployed')
    } catch (err) {
      console.error('[Deploy] Error:', err)
      setRecommendError(err instanceof Error ? err.message : 'Deployment failed')
    } finally {
      setIsDeploying(false)
    }
  }, [selectedSolution])

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

    // Don't fetch visualizations for recommend sessions - they only show workflow UI
    if (!isRecommend) {
      fetchVizData()
    } else {
      // For recommend sessions, skip visualization loading
      setIsVizLoading(false)
    }
    // Only fetch remediate data if we don't already have it from navigation state
    if (isRemediate && !navigationState?.remediateData) {
      fetchRemediateData()
    }
    // Only fetch operate data if we don't already have it from navigation state
    if (isOperate && !navigationState?.operateData) {
      fetchOperateData()
    }
    // Only fetch recommend data if we don't already have it from navigation state
    if (isRecommend && !navigationState?.recommendData) {
      fetchRecommendData()
    }
  }, [sessionId, isRemediate, isOperate, isRecommend, navigationState?.remediateData, navigationState?.operateData, navigationState?.recommendData, fetchVizData, fetchRemediateData, fetchOperateData, fetchRecommendData])

  // Check if we have any tool data to show
  const hasToolData = remediateData || operateData || solutions.length > 0

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
  const title = vizData?.title || (
    remediateData ? 'Remediation Analysis' :
    operateData ? 'Operation Proposal' :
    isRecommend ? 'Deployment Recommendations' :
    'Visualization'
  )

  return (
    <div className="w-full p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h1 className="text-base sm:text-lg font-semibold leading-tight">{title}</h1>
        {/* Hide reload button for recommend sessions - they don't have visualizations */}
        {!isRecommend && (
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
        )}
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

      {/* Section 1c: Recommend workflow */}
      {isRecommend && (
        <div className="mb-4 p-4 rounded-lg border border-border bg-card">
          {isRecommendLoading && recommendStage === 'solutions' && solutions.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <LoadingSpinner />
              <span>Loading recommendations...</span>
            </div>
          ) : (
            <>
              {/* Error message */}
              {recommendError && (
                <div className="mb-4 p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {recommendError}
                </div>
              )}

              {/* Stage: Solutions */}
              {recommendStage === 'solutions' && solutions.length > 0 && (
                <SolutionSelector
                  solutions={solutions}
                  organizationalContext={organizationalContext}
                  onSelect={handleSolutionSelect}
                  isLoading={isRecommendLoading}
                  selectedId={selectedSolution?.solutionId}
                />
              )}

              {/* Stage: Questions */}
              {recommendStage === 'questions' && questions.length > 0 && (
                <>
                  {/* Show selected solution info */}
                  {selectedSolution && (
                    <div className="mb-4 pb-4 border-b border-border">
                      <InfoRenderer
                        template={RECOMMEND_SOLUTION_TEMPLATE}
                        data={selectedSolution as unknown as Record<string, unknown>}
                      />
                    </div>
                  )}
                  <QuestionForm
                    questions={questions}
                    currentStage={currentQuestionStage || 'required'}
                    nextStage={nextStage}
                    onSubmit={handleQuestionsSubmit}
                    onGenerateManifests={handleGenerateManifests}
                    isLoading={isRecommendLoading}
                  />
                </>
              )}

              {/* Stage: Manifests */}
              {recommendStage === 'manifests' && manifests.length > 0 && (
                <>
                  {/* Show selected solution info */}
                  {selectedSolution && (
                    <div className="mb-4 pb-4 border-b border-border">
                      <InfoRenderer
                        template={RECOMMEND_SOLUTION_TEMPLATE}
                        data={selectedSolution as unknown as Record<string, unknown>}
                      />
                    </div>
                  )}
                  <ManifestPreview
                    files={manifests}
                    outputFormat={outputFormat}
                    outputPath={outputPath}
                    onDeploy={handleDeploy}
                    isDeploying={isDeploying}
                    deployResults={deployResponse?.results}
                  />
                </>
              )}

              {/* Stage: Deployed */}
              {recommendStage === 'deployed' && deployResponse && (
                <>
                  {/* Show selected solution info */}
                  {selectedSolution && (
                    <div className="mb-4 pb-4 border-b border-border">
                      <InfoRenderer
                        template={RECOMMEND_SOLUTION_TEMPLATE}
                        data={selectedSolution as unknown as Record<string, unknown>}
                      />
                    </div>
                  )}

                  {/* Deployment status from MCP */}
                  {deployResponse.success && (
                    <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 mb-4">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium text-green-400">
                          {deployResponse.message || 'Deployment Successful'}
                        </span>
                      </div>
                      {deployResponse.kubectlOutput && (
                        <details className="mt-3">
                          <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                            View deployment details
                          </summary>
                          <pre className="mt-2 p-3 bg-muted/50 rounded text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                            {deployResponse.kubectlOutput}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}

                  <ManifestPreview
                    files={manifests}
                    outputFormat={outputFormat}
                    outputPath={outputPath}
                    onDeploy={handleDeploy}
                    isDeploying={false}
                    deployResults={deployResponse.results}
                  />
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Section 2: Insights (skip for tool sessions and when no visualizations - shown inline instead) */}
      {!isRemediate && !isOperate && !isRecommend && hasVisualization && vizData?.insights && vizData.insights.length > 0 && (
        <InsightsPanel sessionId={sessionId!} insights={vizData.insights} />
      )}

      {/* Section 3: Visualizations - skip for recommend sessions (they only show workflow UI) */}
      {!isRecommend && (
        <>
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
        </>
      )}
    </div>
  )
}
