import { fetchWithAuth } from './authHeaders'

export interface AllowedTool {
  /** Tool identifier (MCP uses `name` as the ID field) */
  name: string
  description?: string
  category?: string
}

const API_PATH = '/api/v1'

/**
 * Fetch the list of tools the current user is authorized to use.
 * The MCP server returns only tools matching the user's Kubernetes RBAC bindings.
 */
export async function getAllowedTools(): Promise<AllowedTool[]> {
  const response = await fetchWithAuth(`${API_PATH}/tools`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch tools: ${response.status} ${response.statusText}`)
  }

  const json = await response.json()
  // MCP wraps response in { success, data, meta }
  const data = json.data || json
  return data.tools || data || []
}
