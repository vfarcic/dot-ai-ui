import { useState, useEffect } from 'react'
import { getNamespaces } from '../../api/dashboard'

interface NamespaceSelectorProps {
  value: string
  onChange: (namespace: string) => void
}

export function NamespaceSelector({ value, onChange }: NamespaceSelectorProps) {
  const [namespaces, setNamespaces] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchNamespaces() {
      try {
        setLoading(true)
        setError(null)
        const result = await getNamespaces()
        // Sort namespaces alphabetically
        setNamespaces(result.sort((a, b) => a.localeCompare(b)))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load namespaces')
      } finally {
        setLoading(false)
      }
    }
    fetchNamespaces()
  }, [])

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="namespace-select"
        className="text-sm text-muted-foreground"
      >
        Namespace:
      </label>
      <select
        id="namespace-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        className="bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
      >
        <option value="All Namespaces">All Namespaces</option>
        {loading && <option disabled>Loading...</option>}
        {error && <option disabled>Error loading namespaces</option>}
        {namespaces.map((ns) => (
          <option key={ns} value={ns}>
            {ns}
          </option>
        ))}
      </select>
    </div>
  )
}
