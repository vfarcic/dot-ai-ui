/**
 * MCP Server REST API Client
 * Communicates with the dot-ai MCP server via REST API
 */

import type {
  MCPVisualizationResponse,
  VersionResponse,
  RecommendRequest,
  RemediateRequest,
  OperateRequest,
  ManageOrgDataRequest,
  ProjectSetupRequest,
  ToolName,
} from '@/types'

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string,
    public body?: unknown
  ) {
    super(message)
    this.name = 'APIError'
  }
}

export interface APIClientConfig {
  baseUrl: string
  timeout?: number
}

const DEFAULT_CONFIG: APIClientConfig = {
  baseUrl: '/api/v1',
  timeout: 30000,
}

class MCPClient {
  private config: APIClientConfig

  constructor(config: Partial<APIClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.config.timeout
    )

    try {
      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      if (!response.ok) {
        const body = await response.text()
        let parsedBody: unknown
        try {
          parsedBody = JSON.parse(body)
        } catch {
          parsedBody = body
        }
        throw new APIError(
          `API request failed: ${response.status} ${response.statusText}`,
          response.status,
          response.statusText,
          parsedBody
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

  /**
   * Call an MCP tool via REST API
   */
  async callTool<TRequest, TResponse = MCPVisualizationResponse>(
    toolName: ToolName,
    params: TRequest
  ): Promise<TResponse> {
    return this.request<TResponse>(`/tools/${toolName}`, {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  /**
   * Get system version and health status
   */
  async version(): Promise<VersionResponse> {
    return this.callTool<Record<string, never>, VersionResponse>('version', {})
  }

  /**
   * Get deployment recommendations
   */
  async recommend(params: RecommendRequest): Promise<MCPVisualizationResponse> {
    return this.callTool('recommend', params)
  }

  /**
   * Analyze and remediate Kubernetes issues
   */
  async remediate(params: RemediateRequest): Promise<MCPVisualizationResponse> {
    return this.callTool('remediate', params)
  }

  /**
   * Perform Kubernetes operations (update, scale, etc.)
   */
  async operate(params: OperateRequest): Promise<MCPVisualizationResponse> {
    return this.callTool('operate', params)
  }

  /**
   * Manage organizational data (patterns, policies, capabilities)
   */
  async manageOrgData(
    params: ManageOrgDataRequest
  ): Promise<MCPVisualizationResponse> {
    return this.callTool('manageOrgData', params)
  }

  /**
   * Project setup and governance
   */
  async projectSetup(
    params: ProjectSetupRequest
  ): Promise<MCPVisualizationResponse> {
    return this.callTool('projectSetup', params)
  }

  /**
   * Fetch OpenAPI schema
   */
  async getOpenAPISchema(): Promise<unknown> {
    return this.request('/openapi', { method: 'GET' })
  }
}

// Singleton instance
export const mcpClient = new MCPClient()

// Export for custom configurations
export { MCPClient }
