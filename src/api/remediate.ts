/**
 * Remediate Tool API Client
 * Multi-step workflow: analysis → user decision → execution → results
 */

import { APIError } from './client'
import { fetchWithAuth } from './authHeaders'

const API_PATH = '/api/v1'
const REMEDIATE_TIMEOUT = 30 * 60 * 1000 // 30 minutes for complex analysis
const SESSION_TIMEOUT = 30 * 1000 // 30 seconds for cached session retrieval

// Default execution choices for remediate tool
// Only show "Execute via MCP" - users can use Copy buttons for manual execution
const DEFAULT_EXECUTION_CHOICES: ExecutionChoice[] = [
  {
    id: 1,
    label: 'Execute automatically',
    description: 'Run the kubectl commands shown above automatically via MCP',
  },
]

/**
 * Action to be executed during remediation
 */
export interface RemediateAction {
  description: string
  command: string
  risk: 'low' | 'medium' | 'high'
  rationale?: string
}

/**
 * Execution choice presented to user
 */
export interface ExecutionChoice {
  id: number
  label: string
  description: string
  risk?: string
}

/**
 * Result of an executed action
 */
export interface ExecutionResult {
  action: string
  success: boolean
  output: string
  timestamp?: string
}

/**
 * Response from the Remediate tool
 */
export interface RemediateResponse {
  sessionId: string
  status: 'awaiting_user_approval' | 'success' | 'failed'

  // Analysis data
  analysis: {
    rootCause: string
    confidence: number
    factors: string[]
  }

  // Remediation plan
  remediation: {
    summary: string
    actions: RemediateAction[]
    risk: string
  }

  // Execution choices (when status = 'awaiting_user_approval')
  executionChoices?: ExecutionChoice[]

  // Execution results (when status = 'success' after execution)
  results?: ExecutionResult[]

  // Validation info
  validation?: {
    success: boolean
    summary: string
  }

  // Human-readable guidance
  message?: string
  guidance?: string
}

/**
 * Analyze an issue and get remediation recommendations
 * This is step 1 of the workflow
 *
 * @param issue - Description of the issue to remediate
 * @param signal - Optional AbortSignal to cancel the request
 * @returns Remediation analysis with execution choices
 */
export async function analyzeIssue(issue: string, signal?: AbortSignal): Promise<RemediateResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REMEDIATE_TIMEOUT)

  if (signal) {
    signal.addEventListener('abort', () => controller.abort())
  }

  try {
    const startTime = performance.now()
    console.log(`[Remediate API] Analyzing issue: ${issue}`)

    const response = await fetchWithAuth(`${API_PATH}/tools/remediate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ issue }),
      signal: controller.signal,
    })

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2)
    console.log(`[Remediate API] Response received in ${elapsed}s (status: ${response.status})`)

    if (!response.ok) {
      let errorCode: string | undefined
      let errorMessage = `Remediate failed: ${response.status} ${response.statusText}`

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
      throw new APIError('Invalid response from remediate tool', 500, 'Invalid Response')
    }

    return {
      sessionId: result.sessionId || '',
      status: result.status || 'failed',
      analysis: result.analysis || { rootCause: '', confidence: 0, factors: [] },
      remediation: result.remediation || { summary: '', actions: [], risk: 'unknown' },
      executionChoices: result.executionChoices,
      results: result.results,
      validation: result.validation,
      message: result.message,
      guidance: result.guidance,
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
        throw new APIError('Request timeout - analysis took too long', 408, 'Request Timeout')
      }
      throw new APIError(error.message, 0, 'Network Error')
    }
    throw new APIError('Unknown error', 0, 'Unknown Error')
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Execute the remediation with a chosen option
 * This is step 2 of the workflow
 *
 * @param sessionId - Session ID from analyzeIssue response
 * @param executeChoice - Choice ID (1 = Execute via MCP, 2 = Execute via agent)
 * @param signal - Optional AbortSignal to cancel the request
 * @returns Execution results
 */
export async function executeRemediation(
  sessionId: string,
  executeChoice: number,
  signal?: AbortSignal
): Promise<RemediateResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REMEDIATE_TIMEOUT)

  if (signal) {
    signal.addEventListener('abort', () => controller.abort())
  }

  try {
    const startTime = performance.now()
    console.log(`[Remediate API] Executing choice ${executeChoice} for session ${sessionId}`)

    const response = await fetchWithAuth(`${API_PATH}/tools/remediate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ sessionId, executeChoice }),
      signal: controller.signal,
    })

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2)
    console.log(`[Remediate API] Execution response in ${elapsed}s (status: ${response.status})`)

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
      throw new APIError('Invalid response from remediate tool', 500, 'Invalid Response')
    }

    return {
      sessionId: result.sessionId || sessionId,
      status: result.status || 'failed',
      analysis: result.analysis || { rootCause: '', confidence: 0, factors: [] },
      remediation: result.remediation || { summary: '', actions: [], risk: 'unknown' },
      executionChoices: result.executionChoices,
      results: result.results,
      validation: result.validation,
      message: result.message,
      guidance: result.guidance,
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
 * Get cached remediate session data
 * Used for page refresh and shared URLs
 *
 * @param sessionId - Session ID (e.g., rem-xxx)
 * @param signal - Optional AbortSignal to cancel the request
 * @returns Cached remediation data or null if not found
 */
export async function getRemediateSession(
  sessionId: string,
  signal?: AbortSignal
): Promise<RemediateResponse | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), SESSION_TIMEOUT)

  if (signal) {
    signal.addEventListener('abort', () => controller.abort())
  }

  try {
    console.log(`[Remediate API] Fetching session: ${sessionId}`)

    const response = await fetchWithAuth(`${API_PATH}/sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`[Remediate API] Session not found: ${sessionId}`)
        return null
      }
      throw new APIError(`Failed to fetch session: ${response.status}`, response.status, response.statusText)
    }

    const json = await response.json()
    const sessionData = json.data

    if (!sessionData?.data) {
      console.log(`[Remediate API] Session has no data: ${sessionId}`)
      return null
    }

    // Extract remediate-specific data from generic session format
    const { data } = sessionData
    const finalAnalysis = data.finalAnalysis

    if (!finalAnalysis) {
      console.log(`[Remediate API] Session has no analysis: ${sessionId}`)
      return null
    }

    // Map session data to RemediateResponse format
    // Add default execution choices if status is awaiting_user_approval
    const status = finalAnalysis.status || 'failed'
    const executionChoices = finalAnalysis.executionChoices ||
      (status === 'awaiting_user_approval' ? DEFAULT_EXECUTION_CHOICES : undefined)

    return {
      sessionId: finalAnalysis.sessionId || sessionId,
      status,
      analysis: finalAnalysis.analysis || { rootCause: '', confidence: 0, factors: [] },
      remediation: finalAnalysis.remediation || { summary: '', actions: [], risk: 'unknown' },
      executionChoices,
      results: data.executionResults || finalAnalysis.results,
      validation: finalAnalysis.validation,
      message: finalAnalysis.message,
      guidance: finalAnalysis.guidance,
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
