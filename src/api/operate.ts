/**
 * Operate Tool API Client
 * Multi-step workflow: analysis → user approval → execution → results
 * Used for Day 2 operations: scale, update, rollback, etc.
 */

import { APIError } from './client'

const API_PATH = '/api/v1'
const OPERATE_TIMEOUT = 30 * 60 * 1000 // 30 minutes for complex operations
const SESSION_TIMEOUT = 30 * 1000 // 30 seconds for cached session retrieval

// Default execution choices for operate tool
const DEFAULT_EXECUTION_CHOICES: ExecutionChoice[] = [
  {
    id: 1,
    label: 'Execute automatically',
    description: 'Apply the proposed changes to the cluster via MCP',
  },
]

/**
 * Resource state in current cluster
 */
export interface CurrentResource {
  kind: string
  name: string
  namespace: string
  summary: string
}

/**
 * Proposed change (create, update, or delete)
 */
export interface ProposedChange {
  kind: string
  name: string
  manifest?: string // YAML manifest (not present for deletes)
  rationale: string
}

/**
 * Execution choice presented to user
 */
export interface ExecutionChoice {
  id: number
  label: string
  description: string
}

/**
 * Result of an executed command
 */
export interface ExecutionResult {
  command: string
  success: boolean
  output: string
  timestamp?: string
}

/**
 * Response from the Operate tool
 */
export interface OperateResponse {
  sessionId: string
  status: 'awaiting_user_approval' | 'success' | 'failed'

  // Analysis data (present in initial response)
  analysis?: {
    summary: string
    currentState: {
      resources: CurrentResource[]
    }
    proposedChanges: {
      create: ProposedChange[]
      update: ProposedChange[]
      delete: ProposedChange[]
    }
    commands: string[]
    dryRunValidation: {
      status: 'success' | 'failed'
      details: string
    }
    patternsApplied: string[]
    capabilitiesUsed: string[]
    policiesChecked: string[]
    risks: {
      level: 'low' | 'medium' | 'high'
      description: string
    }
    validationIntent: string
  }

  // Execution data (present after execution)
  execution?: {
    results: ExecutionResult[]
    validation: string
  }

  // Execution choices (when status = 'awaiting_user_approval')
  executionChoices?: ExecutionChoice[]

  // Human-readable messages
  message?: string
  nextAction?: string
}

/**
 * Analyze an operation intent and get proposed changes
 * This is step 1 of the workflow
 *
 * @param intent - Description of the operation to perform
 * @param signal - Optional AbortSignal to cancel the request
 * @returns Operation analysis with proposed changes and execution choices
 */
export async function operateCluster(intent: string, signal?: AbortSignal): Promise<OperateResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), OPERATE_TIMEOUT)

  if (signal) {
    signal.addEventListener('abort', () => controller.abort())
  }

  try {
    const startTime = performance.now()
    console.log(`[Operate API] Analyzing intent: ${intent}`)

    const response = await fetch(`${API_PATH}/tools/operate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ intent }),
      signal: controller.signal,
    })

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2)
    console.log(`[Operate API] Response received in ${elapsed}s (status: ${response.status})`)

    if (!response.ok) {
      let errorCode: string | undefined
      let errorMessage = `Operate failed: ${response.status} ${response.statusText}`

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
      throw new APIError('Invalid response from operate tool', 500, 'Invalid Response')
    }

    return {
      sessionId: result.sessionId || '',
      status: result.status || 'failed',
      analysis: result.analysis,
      execution: result.execution,
      executionChoices: result.executionChoices,
      message: result.message,
      nextAction: result.nextAction,
    }
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
 * Execute the operation with a chosen option
 * This is step 2 of the workflow
 *
 * @param sessionId - Session ID from operateCluster response
 * @param executeChoice - Choice ID (1 = Execute via MCP)
 * @param signal - Optional AbortSignal to cancel the request
 * @returns Execution results
 */
export async function executeOperation(
  sessionId: string,
  executeChoice: number,
  signal?: AbortSignal
): Promise<OperateResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), OPERATE_TIMEOUT)

  if (signal) {
    signal.addEventListener('abort', () => controller.abort())
  }

  try {
    const startTime = performance.now()
    console.log(`[Operate API] Executing choice ${executeChoice} for session ${sessionId}`)

    const response = await fetch(`${API_PATH}/tools/operate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ sessionId, executeChoice }),
      signal: controller.signal,
    })

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2)
    console.log(`[Operate API] Execution response in ${elapsed}s (status: ${response.status})`)

    if (!response.ok) {
      let errorCode: string | undefined
      let errorMessage = `Execution failed: ${response.status} ${response.statusText}`

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
      throw new APIError('Invalid response from operate tool', 500, 'Invalid Response')
    }

    return {
      sessionId: result.sessionId || sessionId,
      status: result.status || 'failed',
      analysis: result.analysis,
      execution: result.execution,
      executionChoices: result.executionChoices,
      message: result.message,
      nextAction: result.nextAction,
    }
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        if (signal?.aborted) {
          throw new APIError('Request cancelled', 0, 'Cancelled')
        }
        throw new APIError('Request timeout - execution took too long', 408, 'Request Timeout')
      }
      throw new APIError(error.message, 0, 'Network Error')
    }
    throw new APIError('Unknown error', 0, 'Unknown Error')
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Get cached operate session data
 * Used for page refresh and shared URLs
 *
 * @param sessionId - Session ID (e.g., opr-xxx)
 * @param signal - Optional AbortSignal to cancel the request
 * @returns Cached operation data or null if not found
 */
export async function getOperateSession(
  sessionId: string,
  signal?: AbortSignal
): Promise<OperateResponse | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), SESSION_TIMEOUT)

  if (signal) {
    signal.addEventListener('abort', () => controller.abort())
  }

  try {
    console.log(`[Operate API] Fetching session: ${sessionId}`)

    const response = await fetch(`${API_PATH}/sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`[Operate API] Session not found: ${sessionId}`)
        return null
      }
      throw new APIError(`Failed to fetch session: ${response.status}`, response.status, response.statusText)
    }

    const json = await response.json()
    const sessionData = json.data

    if (!sessionData?.data) {
      console.log(`[Operate API] Session has no data: ${sessionId}`)
      return null
    }

    // Extract operate-specific data from generic session format
    const { data } = sessionData
    const finalAnalysis = data.finalAnalysis

    if (!finalAnalysis) {
      console.log(`[Operate API] Session has no analysis: ${sessionId}`)
      return null
    }

    // Map session data to OperateResponse format
    // Add default execution choices if status is awaiting_user_approval
    const status = finalAnalysis.status || 'failed'
    const executionChoices = finalAnalysis.executionChoices ||
      (status === 'awaiting_user_approval' ? DEFAULT_EXECUTION_CHOICES : undefined)

    return {
      sessionId: finalAnalysis.sessionId || sessionId,
      status,
      analysis: finalAnalysis.analysis,
      execution: data.executionResults ? { results: data.executionResults, validation: '' } : finalAnalysis.execution,
      executionChoices,
      message: finalAnalysis.message,
      nextAction: finalAnalysis.nextAction,
    }
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
