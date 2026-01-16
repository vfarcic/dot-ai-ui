/**
 * Query Tool API Client
 * Fetches AI-powered analysis from the MCP server using visualization mode
 */

import { APIError } from './client'
import { fetchWithAuth } from './authHeaders'
import type { Visualization } from '@/types'

const API_PATH = '/api/v1'
const QUERY_TIMEOUT = 30 * 60 * 1000 // 30 minutes for complex AI queries

/**
 * Response from the Query tool in visualization mode
 */
export interface QueryResponse {
  sessionId: string
  title: string
  visualizations: Visualization[]
  insights: string[]
  toolsUsed?: string[]
}

/**
 * Query the cluster using natural language
 * Uses visualization mode to get structured data for UI rendering
 *
 * @param intent - Natural language query about the cluster
 * @param signal - Optional AbortSignal to cancel the request
 * @returns Visualization data with title, visualizations, and insights
 * @throws APIError for network errors, timeouts, or server errors
 */
export async function queryCluster(intent: string, signal?: AbortSignal): Promise<QueryResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), QUERY_TIMEOUT)

  // If external signal is provided, listen for abort and forward it
  if (signal) {
    signal.addEventListener('abort', () => controller.abort())
  }

  try {
    const startTime = performance.now()
    console.log(`[Query API] Sending query: ${intent}`)

    const response = await fetchWithAuth(`${API_PATH}/tools/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        // Prefix with [visualization] to get inline visualization data
        intent: `[visualization] ${intent}`,
      }),
      signal: controller.signal,
    })

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2)
    console.log(`[Query API] Response received in ${elapsed}s (status: ${response.status})`)

    if (!response.ok) {
      // Try to extract error details from response body
      let errorCode: string | undefined
      let errorMessage = `Query failed: ${response.status} ${response.statusText}`

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

    // Extract visualization data from MCP response
    // Response format: { success: true, data: { tool, result: { title, visualizations, insights } } }
    const result = json.data?.result

    if (!result) {
      throw new APIError('Invalid response from query tool', 500, 'Invalid Response')
    }

    return {
      sessionId: result.sessionId || '',
      title: result.title || 'Query Results',
      visualizations: result.visualizations || [],
      insights: result.insights || [],
      toolsUsed: result.toolsUsed,
    }
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        // Check if it was user-initiated cancellation vs timeout
        if (signal?.aborted) {
          throw new APIError('Request cancelled', 0, 'Cancelled')
        }
        throw new APIError('Request timeout - query took too long', 408, 'Request Timeout')
      }
      throw new APIError(error.message, 0, 'Network Error')
    }
    throw new APIError('Unknown error', 0, 'Unknown Error')
  } finally {
    clearTimeout(timeoutId)
  }
}
