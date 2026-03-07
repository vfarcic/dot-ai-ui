import { useState, useEffect, useCallback } from 'react'
import { getUsers, createUser, deleteUser, type User } from '../api/users'

export function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Delete confirmation state
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getUsers()
      setUsers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return

    try {
      setCreating(true)
      setCreateError(null)
      await createUser(email.trim(), password)
      setEmail('')
      setPassword('')
      await fetchUsers()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingEmail) return

    try {
      setDeleteLoading(true)
      await deleteUser(deletingEmail)
      setDeletingEmail(null)
      await fetchUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
      setDeletingEmail(null)
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl">
      <h1 className="text-xl font-semibold text-foreground mb-6">User Management</h1>

      {/* Create user form */}
      <form onSubmit={handleCreate} className="mb-8 p-4 bg-header-bg border border-border rounded-lg">
        <h2 className="text-sm font-medium text-foreground mb-3">Create User</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            placeholder="Email"
            aria-label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            type="password"
            placeholder="Password"
            aria-label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={creating || !email.trim() || !password.trim()}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {creating ? 'Creating...' : 'Create User'}
          </button>
        </div>
        {createError && (
          <p className="mt-2 text-sm text-red-500">{createError}</p>
        )}
      </form>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-md text-sm text-red-500">
          {error}
        </div>
      )}

      {/* User list */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading users...</div>
      ) : users.length === 0 ? (
        <div className="text-sm text-muted-foreground">No users found.</div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-header-bg border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.email} className="border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 text-foreground">{user.email}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setDeletingEmail(user.email)}
                      className="text-red-500 hover:text-red-400 text-sm transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deletingEmail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          onKeyDown={(e) => { if (e.key === 'Escape' && !deleteLoading) setDeletingEmail(null) }}
        >
          <div className="fixed inset-0 bg-black/50" onClick={() => !deleteLoading && setDeletingEmail(null)} />
          <div className="relative bg-background border border-border rounded-lg shadow-lg p-6 max-w-sm w-full mx-4">
            <h3 id="delete-dialog-title" className="text-sm font-medium text-foreground mb-2">Delete User</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to delete <span className="text-foreground font-medium">{deletingEmail}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingEmail(null)}
                disabled={deleteLoading}
                className="px-3 py-1.5 text-sm border border-border rounded-md text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
