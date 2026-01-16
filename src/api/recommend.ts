/**
 * Recommend Tool API Client
 * Multi-stage workflow: intent → solutions → questions → manifests → deploy
 * Used for AI-powered deployment recommendations
 */

import { APIError } from './client'
import { fetchWithAuth } from './authHeaders'

const API_PATH = '/api/v1'
const RECOMMEND_TIMEOUT = 30 * 60 * 1000 // 30 minutes for complex operations
const SESSION_TIMEOUT = 30 * 1000 // 30 seconds for cached session retrieval

/**
 * Workflow stages for the recommend tool
 */
export type RecommendStage =
  | 'recommend'
  | 'chooseSolution'
  | 'answerQuestion:required'
  | 'answerQuestion:basic'
  | 'answerQuestion:advanced'
  | 'answerQuestion:open'
  | 'generateManifests'
  | 'deployManifests'

/**
 * Resource in a solution
 */
export interface SolutionResource {
  kind: string
  apiVersion: string
  group: string
  description: string
}

/**
 * A recommended solution
 */
export interface Solution {
  solutionId: string
  type: string
  score: number
  description: string
  primaryResources: string[]
  resources: SolutionResource[]
  reasons: string[]
  appliedPatterns: string[]
  relevantPolicies: string[]
}

/**
 * Organizational context for solutions
 */
export interface OrganizationalContext {
  solutionsUsingPatterns: number
  totalSolutions: number
  totalPatterns: number
  totalPolicies: number
  patternsAvailable: string
  policiesAvailable: string
}

/**
 * Question validation rules
 */
export interface QuestionValidation {
  required?: boolean
  pattern?: string
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
}

/**
 * A question in a stage
 */
export interface Question {
  id: string
  question: string
  type: 'text' | 'number' | 'select'
  placeholder?: string
  options?: string[]
  validation?: QuestionValidation
  suggestedAnswer?: string | number | null
  answer?: string | number
}

/**
 * A generated manifest file
 */
export interface ManifestFile {
  relativePath: string
  content: string
}

/**
 * Deployment result for a single resource
 */
export interface DeploymentResult {
  resource: string
  status: string
  message: string
}

/**
 * Response when intent needs refinement
 */
export interface RecommendRefinementResponse {
  needsRefinement: true
  intent: string
  guidance: string
}

/**
 * Response with solutions
 */
export interface RecommendSolutionsResponse {
  intent: string
  solutions: Solution[]
  organizationalContext: OrganizationalContext
  nextAction: string
  guidance: string
  visualizationUrl: string
}

/**
 * Response with questions for a stage
 */
export interface RecommendQuestionsResponse {
  status: 'stage_questions'
  solutionId: string
  currentStage: 'required' | 'basic' | 'advanced' | 'open'
  questions: Question[]
  nextStage: string
  message: string
  nextAction: string
  guidance: string
  agentInstructions: string
}

/**
 * Response with generated manifests
 */
export interface RecommendManifestResponse {
  success: true
  status: 'manifests_generated'
  solutionId: string
  outputFormat: 'raw' | 'helm' | 'kustomize'
  outputPath: string
  files: ManifestFile[]
  validationAttempts: number
  agentInstructions: string
  visualizationUrl: string
}

/**
 * Response after deployment
 */
export interface RecommendDeployResponse {
  success: boolean
  solutionId: string
  solutionType?: string
  manifestPath?: string
  readinessTimeout?: boolean
  message?: string
  kubectlOutput?: string
  deploymentComplete?: boolean
  requiresStatusCheck?: boolean
  timestamp?: string
  // Optional per-resource results (may be returned by some deployment methods)
  results?: DeploymentResult[]
}

/**
 * Union type for all recommend responses
 */
export type RecommendResponse =
  | RecommendRefinementResponse
  | RecommendSolutionsResponse
  | RecommendQuestionsResponse
  | RecommendManifestResponse
  | RecommendDeployResponse

/**
 * Type guards for response types
 */
export function isRefinementResponse(response: RecommendResponse): response is RecommendRefinementResponse {
  return 'needsRefinement' in response && response.needsRefinement === true
}

export function isSolutionsResponse(response: RecommendResponse): response is RecommendSolutionsResponse {
  return 'solutions' in response && Array.isArray(response.solutions)
}

export function isQuestionsResponse(response: RecommendResponse): response is RecommendQuestionsResponse {
  return 'status' in response && response.status === 'stage_questions'
}

export function isManifestResponse(response: RecommendResponse): response is RecommendManifestResponse {
  return 'status' in response && response.status === 'manifests_generated'
}

export function isDeployResponse(response: RecommendResponse): response is RecommendDeployResponse {
  return 'success' in response && 'solutionId' in response && 'deploymentComplete' in response
}

/**
 * Unified recommendation workflow state
 * Tracks the current stage and accumulated data
 */
export interface RecommendWorkflowState {
  stage: 'initial' | 'solutions' | 'questions' | 'manifests' | 'deployed' | 'error'
  intent?: string
  solutions?: Solution[]
  organizationalContext?: OrganizationalContext
  selectedSolution?: Solution
  currentQuestionStage?: string
  questions?: Question[]
  nextStage?: string
  answers?: Record<string, string | number>
  manifests?: ManifestFile[]
  outputFormat?: string
  outputPath?: string
  deployResults?: DeploymentResult[]
  guidance?: string
  error?: string
}

/**
 * Submit an intent for recommendation
 * If final=false (default), may return refinement guidance
 * If final=true, proceeds to solutions
 *
 * @param intent - Description of what to deploy
 * @param final - If true, skip refinement and proceed to solutions
 * @param signal - Optional AbortSignal to cancel the request
 * @returns Solutions or refinement guidance
 */
export async function submitRecommendIntent(
  intent: string,
  final = false,
  signal?: AbortSignal
): Promise<RecommendRefinementResponse | RecommendSolutionsResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), RECOMMEND_TIMEOUT)

  if (signal) {
    signal.addEventListener('abort', () => controller.abort())
  }

  try {
    const startTime = performance.now()
    console.log(`[Recommend API] Submitting intent: ${intent}`)

    const body: Record<string, unknown> = { intent }
    if (final) {
      body.final = true
    }

    const response = await fetchWithAuth(`${API_PATH}/tools/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2)
    console.log(`[Recommend API] Response received in ${elapsed}s (status: ${response.status})`)

    if (!response.ok) {
      let errorCode: string | undefined
      let errorMessage = `Recommend failed: ${response.status} ${response.statusText}`

      try {
        const errorBody = await response.json()
        if (errorBody.error) {
          errorCode = errorBody.error.code
          errorMessage = errorBody.error.message || errorMessage
        }
      } catch {
        // Failed to parse error body
      }

      throw new APIError(errorMessage, response.status, response.statusText, errorCode)
    }

    const json = await response.json()
    const result = json.data?.result

    if (!result) {
      throw new APIError('Invalid response from recommend tool', 500, 'Invalid Response')
    }

    return result
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        if (signal?.aborted) {
          throw new APIError('Request cancelled', 0, 'Cancelled')
        }
        throw new APIError('Request timeout - operation took too long', 408, 'Request Timeout')
      }
      throw new APIError(error.message, 0, 'Network Error')
    }
    throw new APIError('Unknown error', 0, 'Unknown Error')
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Choose a solution to proceed with
 *
 * @param solutionId - ID of the selected solution
 * @param signal - Optional AbortSignal to cancel the request
 * @returns Questions for the first stage (required)
 */
export async function chooseSolution(
  solutionId: string,
  signal?: AbortSignal
): Promise<RecommendQuestionsResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), RECOMMEND_TIMEOUT)

  if (signal) {
    signal.addEventListener('abort', () => controller.abort())
  }

  try {
    const startTime = performance.now()
    console.log(`[Recommend API] Choosing solution: ${solutionId}`)

    const response = await fetchWithAuth(`${API_PATH}/tools/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        stage: 'chooseSolution',
        solutionId,
      }),
      signal: controller.signal,
    })

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2)
    console.log(`[Recommend API] Response received in ${elapsed}s (status: ${response.status})`)

    if (!response.ok) {
      let errorCode: string | undefined
      let errorMessage = `Choose solution failed: ${response.status} ${response.statusText}`

      try {
        const errorBody = await response.json()
        if (errorBody.error) {
          errorCode = errorBody.error.code
          errorMessage = errorBody.error.message || errorMessage
        }
      } catch {
        // Failed to parse error body
      }

      throw new APIError(errorMessage, response.status, response.statusText, errorCode)
    }

    const json = await response.json()
    const result = json.data?.result

    if (!result) {
      throw new APIError('Invalid response from recommend tool', 500, 'Invalid Response')
    }

    return result
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        if (signal?.aborted) {
          throw new APIError('Request cancelled', 0, 'Cancelled')
        }
        throw new APIError('Request timeout - operation took too long', 408, 'Request Timeout')
      }
      throw new APIError(error.message, 0, 'Network Error')
    }
    throw new APIError('Unknown error', 0, 'Unknown Error')
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Answer questions for a stage
 *
 * @param solutionId - ID of the selected solution
 * @param stage - Current question stage (required, basic, advanced, open)
 * @param answers - Answers to the questions
 * @param signal - Optional AbortSignal to cancel the request
 * @returns Next stage questions or ready for manifest generation
 */
export async function answerQuestions(
  solutionId: string,
  stage: 'required' | 'basic' | 'advanced' | 'open',
  answers: Record<string, string | number>,
  signal?: AbortSignal
): Promise<RecommendQuestionsResponse | RecommendManifestResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), RECOMMEND_TIMEOUT)

  if (signal) {
    signal.addEventListener('abort', () => controller.abort())
  }

  try {
    const startTime = performance.now()
    console.log(`[Recommend API] Answering questions for stage: ${stage}`)

    const response = await fetchWithAuth(`${API_PATH}/tools/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        stage: `answerQuestion:${stage}`,
        solutionId,
        answers,
      }),
      signal: controller.signal,
    })

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2)
    console.log(`[Recommend API] Response received in ${elapsed}s (status: ${response.status})`)

    if (!response.ok) {
      let errorCode: string | undefined
      let errorMessage = `Answer questions failed: ${response.status} ${response.statusText}`

      try {
        const errorBody = await response.json()
        if (errorBody.error) {
          errorCode = errorBody.error.code
          errorMessage = errorBody.error.message || errorMessage
        }
      } catch {
        // Failed to parse error body
      }

      throw new APIError(errorMessage, response.status, response.statusText, errorCode)
    }

    const json = await response.json()
    const result = json.data?.result

    if (!result) {
      throw new APIError('Invalid response from recommend tool', 500, 'Invalid Response')
    }

    return result
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        if (signal?.aborted) {
          throw new APIError('Request cancelled', 0, 'Cancelled')
        }
        throw new APIError('Request timeout - operation took too long', 408, 'Request Timeout')
      }
      throw new APIError(error.message, 0, 'Network Error')
    }
    throw new APIError('Unknown error', 0, 'Unknown Error')
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Generate manifests for the selected solution
 *
 * @param solutionId - ID of the selected solution
 * @param signal - Optional AbortSignal to cancel the request
 * @returns Generated manifest files
 */
export async function generateManifests(
  solutionId: string,
  signal?: AbortSignal
): Promise<RecommendManifestResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), RECOMMEND_TIMEOUT)

  if (signal) {
    signal.addEventListener('abort', () => controller.abort())
  }

  try {
    const startTime = performance.now()
    console.log(`[Recommend API] Generating manifests for solution: ${solutionId}`)

    const response = await fetchWithAuth(`${API_PATH}/tools/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        stage: 'generateManifests',
        solutionId,
      }),
      signal: controller.signal,
    })

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2)
    console.log(`[Recommend API] Response received in ${elapsed}s (status: ${response.status})`)

    if (!response.ok) {
      let errorCode: string | undefined
      let errorMessage = `Generate manifests failed: ${response.status} ${response.statusText}`

      try {
        const errorBody = await response.json()
        if (errorBody.error) {
          errorCode = errorBody.error.code
          errorMessage = errorBody.error.message || errorMessage
        }
      } catch {
        // Failed to parse error body
      }

      throw new APIError(errorMessage, response.status, response.statusText, errorCode)
    }

    const json = await response.json()
    const result = json.data?.result

    if (!result) {
      throw new APIError('Invalid response from recommend tool', 500, 'Invalid Response')
    }

    return result
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        if (signal?.aborted) {
          throw new APIError('Request cancelled', 0, 'Cancelled')
        }
        throw new APIError('Request timeout - operation took too long', 408, 'Request Timeout')
      }
      throw new APIError(error.message, 0, 'Network Error')
    }
    throw new APIError('Unknown error', 0, 'Unknown Error')
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Deploy generated manifests to the cluster
 *
 * @param solutionId - ID of the selected solution
 * @param timeout - Optional deployment timeout in seconds
 * @param signal - Optional AbortSignal to cancel the request
 * @returns Deployment results
 */
export async function deployManifests(
  solutionId: string,
  timeout?: number,
  signal?: AbortSignal
): Promise<RecommendDeployResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), RECOMMEND_TIMEOUT)

  if (signal) {
    signal.addEventListener('abort', () => controller.abort())
  }

  try {
    const startTime = performance.now()
    console.log(`[Recommend API] Deploying manifests for solution: ${solutionId}`)

    const body: Record<string, unknown> = {
      stage: 'deployManifests',
      solutionId,
    }
    if (timeout) {
      body.timeout = timeout
    }

    const response = await fetchWithAuth(`${API_PATH}/tools/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2)
    console.log(`[Recommend API] Response received in ${elapsed}s (status: ${response.status})`)

    if (!response.ok) {
      let errorCode: string | undefined
      let errorMessage = `Deploy manifests failed: ${response.status} ${response.statusText}`

      try {
        const errorBody = await response.json()
        if (errorBody.error) {
          errorCode = errorBody.error.code
          errorMessage = errorBody.error.message || errorMessage
        }
      } catch {
        // Failed to parse error body
      }

      throw new APIError(errorMessage, response.status, response.statusText, errorCode)
    }

    const json = await response.json()
    const result = json.data?.result

    if (!result) {
      throw new APIError('Invalid response from recommend tool', 500, 'Invalid Response')
    }

    return result
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        if (signal?.aborted) {
          throw new APIError('Request cancelled', 0, 'Cancelled')
        }
        throw new APIError('Request timeout - operation took too long', 408, 'Request Timeout')
      }
      throw new APIError(error.message, 0, 'Network Error')
    }
    throw new APIError('Unknown error', 0, 'Unknown Error')
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Get cached recommend session data
 * Used for page refresh and shared URLs
 *
 * @param sessionId - Session ID (e.g., sol-xxx)
 * @param signal - Optional AbortSignal to cancel the request
 * @returns Cached recommendation data or null if not found
 */
export async function getRecommendSession(
  sessionId: string,
  signal?: AbortSignal
): Promise<RecommendWorkflowState | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), SESSION_TIMEOUT)

  if (signal) {
    signal.addEventListener('abort', () => controller.abort())
  }

  try {
    console.log(`[Recommend API] Fetching session: ${sessionId}`)

    const response = await fetchWithAuth(`${API_PATH}/sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`[Recommend API] Session not found: ${sessionId}`)
        return null
      }
      throw new APIError(`Failed to fetch session: ${response.status}`, response.status, response.statusText)
    }

    const json = await response.json()
    const sessionData = json.data

    if (!sessionData?.data) {
      console.log(`[Recommend API] Session has no data: ${sessionId}`)
      return null
    }

    // Extract recommend-specific data from generic session format
    const { data } = sessionData

    // Map session data to RecommendWorkflowState format
    // Use data.stage as source of truth (set by MCP at each stage transition)
    const state: RecommendWorkflowState = {
      stage: data.stage || 'initial',
      intent: data.intent,
    }

    // Restore solutions list (allSolutions preserves all options even after selection)
    if (data.allSolutions && Array.isArray(data.allSolutions)) {
      state.solutions = data.allSolutions
    } else if (data.solutions && Array.isArray(data.solutions)) {
      // Fallback to solutions if allSolutions not present
      state.solutions = data.solutions
    }

    // Restore organizational context if present
    if (data.organizationalContext) {
      state.organizationalContext = data.organizationalContext
    }

    // Restore selected solution - build from session data fields
    if (data.solutionId || data.description) {
      state.selectedSolution = {
        solutionId: sessionData.sessionId || data.solutionId,
        type: data.type || 'single',
        score: data.score || 0,
        description: data.description || '',
        primaryResources: data.primaryResources || [],
        resources: data.resources || [],
        reasons: data.reasons || [],
        appliedPatterns: data.appliedPatterns || [],
        relevantPolicies: data.relevantPolicies || [],
      }
    }

    // Restore questions for current stage
    // Questions are organized by stage: data.questions.required, data.questions.basic, etc.
    if (data.questions && data.currentQuestionStage) {
      const questionsForStage = data.questions[data.currentQuestionStage]
      if (Array.isArray(questionsForStage)) {
        // Merge answers into questions so the form can pre-fill them
        state.questions = questionsForStage.map((q: Question) => ({
          ...q,
          answer: data.answers?.[q.id] ?? q.answer,
        }))
      }
      state.currentQuestionStage = data.currentQuestionStage
      state.nextStage = data.nextQuestionStage
    }

    // Restore user's answers (for reference)
    if (data.answers) {
      state.answers = data.answers
    }

    // Restore manifests from generatedManifests
    if (data.generatedManifests) {
      const gm = data.generatedManifests
      state.manifests = gm.files || []
      state.outputFormat = gm.type || 'raw'
      state.outputPath = gm.outputPath || './manifests'
    } else if (data.files) {
      // Fallback to files if generatedManifests not present
      state.manifests = data.files
      state.outputFormat = data.outputFormat || 'raw'
      state.outputPath = data.outputPath || './manifests'
    }

    // Restore deployment results
    if (data.deployResults) {
      state.deployResults = data.deployResults
    }

    console.log(`[Recommend API] Session restored - stage: ${state.stage}, questionStage: ${state.currentQuestionStage}, questions: ${state.questions?.length || 0}`)

    return state
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        if (signal?.aborted) {
          throw new APIError('Request cancelled', 0, 'Cancelled')
        }
        throw new APIError('Request timeout', 408, 'Request Timeout')
      }
      throw new APIError(error.message, 0, 'Network Error')
    }
    throw new APIError('Unknown error', 0, 'Unknown Error')
  } finally {
    clearTimeout(timeoutId)
  }
}
