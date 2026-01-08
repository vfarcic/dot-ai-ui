// MOCK: Replace with MCP `listNamespaces` API call
import { namespaces } from '../../data/mockK8sData'

interface NamespaceSelectorProps {
  value: string
  onChange: (namespace: string) => void
}

export function NamespaceSelector({ value, onChange }: NamespaceSelectorProps) {
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
        className="bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
      >
        <option value="All Namespaces">All Namespaces</option>
        {namespaces.map((ns) => (
          <option key={ns} value={ns}>
            {ns}
          </option>
        ))}
      </select>
    </div>
  )
}
