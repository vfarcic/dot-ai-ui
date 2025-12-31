/**
 * Visualization API Client
 * Fetches visualization data from the MCP server
 */

import type { VisualizationResponse } from '@/types'

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string
  ) {
    super(message)
    this.name = 'APIError'
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'
const DEFAULT_TIMEOUT = 30000

/**
 * Fetch visualization data for a session
 * @param sessionId - The session ID from the MCP tool response URL
 * @returns Visualization data including title, visualizations array, and insights
 * @throws APIError for network errors, timeouts, or invalid sessions
 */
export async function getVisualization(
  sessionId: string
): Promise<VisualizationResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT)

  try {
    const response = await fetch(`${API_BASE_URL}/visualize/${sessionId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      if (response.status === 404) {
        throw new APIError(
          'Session not found or expired',
          response.status,
          response.statusText
        )
      }
      throw new APIError(
        `API request failed: ${response.status} ${response.statusText}`,
        response.status,
        response.statusText
      )
    }

    return response.json()
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
