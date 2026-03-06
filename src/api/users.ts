import { fetchWithAuth } from './authHeaders'

const API_PATH = '/api/v1'

export interface User {
  email: string
}

export async function getUsers(): Promise<User[]> {
  const response = await fetchWithAuth(`${API_PATH}/users`)

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Failed to fetch users: ${response.status}`)
  }

  const json = await response.json()
  // MCP wraps response: { success, data: { users: [...] } }
  return json.data?.users || json.users || json
}

export async function createUser(email: string, password: string): Promise<void> {
  const response = await fetchWithAuth(`${API_PATH}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Failed to create user: ${response.status}`)
  }
}

export async function deleteUser(email: string): Promise<void> {
  const response = await fetchWithAuth(`${API_PATH}/users/${encodeURIComponent(email)}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Failed to delete user: ${response.status}`)
  }
}
