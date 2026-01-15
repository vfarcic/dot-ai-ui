/**
 * Visualization API Client
 * Fetches visualization data from the MCP server
 */

import type { VisualizationResponse } from '@/types'
import { fetchWithAuth } from './authHeaders'

/**
 * Error types based on actual MCP server responses:
 * - session-expired: 404 SESSION_NOT_FOUND
 * - ai-unavailable: 503 AI_NOT_CONFIGURED
 * - server: 500 VISUALIZATION_ERROR
 * - network: Connection failed (status 0)
 * - timeout: Request aborted (status 408)
 */
export type ErrorType = 'session-expired' | 'ai-unavailable' | 'server' | 'network' | 'timeout'

export class APIError extends Error {
  public readonly errorType: ErrorType
  public readonly errorCode?: string

  constructor(
    message: string,
    public status: number,
    public statusText: string,
    errorCode?: string
  ) {
    super(message)
    this.name = 'APIError'
    this.errorCode = errorCode
    this.errorType = this.classifyError(status, errorCode)
  }

  private classifyError(status: number, errorCode?: string): ErrorType {
    // Only treat as session-expired with explicit MCP error code, not generic 404s
    // (generic 404s during server restart should be retryable server errors)
    if (errorCode === 'SESSION_NOT_FOUND') return 'session-expired'
    if (status === 503 || errorCode === 'AI_NOT_CONFIGURED') return 'ai-unavailable'
    if (status === 408) return 'timeout'
    if (status === 0) return 'network'
    return 'server'
  }

  get isRetryable(): boolean {
    return this.errorType !== 'session-expired'
  }
}

const API_PATH = '/api/v1'
const DEFAULT_TIMEOUT = 5 * 60 * 1000 // 5 minutes for AI generation

export interface GetVisualizationOptions {
  reload?: boolean
}

/**
 * Fetch visualization data for a session
 * @param sessionId - The session ID from the MCP tool response URL
 * @param options - Optional parameters (reload: invalidate cache and regenerate)
 * @returns Visualization data including title, visualizations array, and insights
 * @throws APIError for network errors, timeouts, or invalid sessions
 */
export async function getVisualization(
  sessionId: string,
  options?: GetVisualizationOptions
): Promise<VisualizationResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT)

  try {
    const startTime = performance.now()
    const reloadParam = options?.reload ? '?reload=true' : ''
    console.log(`[API] Fetching visualization for session: ${sessionId}${options?.reload ? ' (reload)' : ''}`)

    const response = await fetchWithAuth(`${API_PATH}/visualize/${sessionId}${reloadParam}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    })

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2)
    console.log(`[API] Response received in ${elapsed}s (status: ${response.status})`)

    if (!response.ok) {
      // Try to extract error details from MCP response body
      let errorCode: string | undefined
      let errorMessage = `API request failed: ${response.status} ${response.statusText}`

      try {
        const errorBody = await response.json()
        if (errorBody.error) {
          errorCode = errorBody.error.code
          errorMessage = errorBody.error.message || errorMessage
        }
      } catch {
        // Failed to parse error body, use defaults
      }

      throw new APIError(errorMessage, response.status, response.statusText, errorCode)
    }

    const json = await response.json()
    // MCP wraps response in { success, data, meta }
    return json.data || json
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new APIError('Request timeout', 408, 'Request Timeout')
      }
      throw new APIError(error.message, 0, 'Network Error')
    }
    throw new APIError('Unknown error', 0, 'Unknown Error')
  } finally {
    clearTimeout(timeoutId)
  }
}
