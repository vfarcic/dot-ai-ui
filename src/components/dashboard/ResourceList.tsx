// MOCK: Replace getResources with MCP `listResources` API call
// MOCK: Status fields (status, ready, restarts, replicas) need K8s API enrichment
import {
  getResources,
  getColumnsForKind,
  type K8sResource,
} from '../../data/mockK8sData'
import { StatusBadge } from './StatusBadge'

interface ResourceListProps {
  kind: string
  namespace: string
}

function getCellValue(resource: K8sResource, column: string): React.ReactNode {
  switch (column) {
    case 'Name':
      return (
        <span className="font-medium text-foreground hover:text-primary cursor-pointer">
          {resource.name}
        </span>
      )
    case 'Namespace':
      return (
        <span className="text-muted-foreground">{resource.namespace}</span>
      )
    case 'Status':
    case 'Sync Status':
      return <StatusBadge status={resource.status} />
    case 'Ready':
      return <span className="font-mono text-sm">{resource.ready}</span>
    case 'Restarts':
      return (
        <span
          className={`font-mono text-sm ${(resource.restarts ?? 0) > 5 ? 'text-red-400' : ''}`}
        >
          {resource.restarts}
        </span>
      )
    case 'Replicas':
      return <span className="font-mono text-sm">{resource.replicas}</span>
    case 'Type':
      return <span className="text-muted-foreground">{resource.type}</span>
    case 'Cluster IP':
      return (
        <span className="font-mono text-sm text-muted-foreground">
          {resource.clusterIP}
        </span>
      )
    case 'Ports':
      return (
        <span className="font-mono text-sm text-muted-foreground">
          {resource.ports}
        </span>
      )
    case 'Age':
      return <span className="text-muted-foreground">{resource.age}</span>
    default:
      return null
  }
}

export function ResourceList({ kind, namespace }: ResourceListProps) {
  const resources = getResources(kind, namespace)
  const columns = getColumnsForKind(kind)

  if (resources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <svg
          className="w-12 h-12 text-muted-foreground mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
        <h3 className="text-lg font-medium text-foreground mb-1">
          No {kind} found
        </h3>
        <p className="text-sm text-muted-foreground">
          {namespace === 'All Namespaces'
            ? `No ${kind.toLowerCase()} exist in any namespace`
            : `No ${kind.toLowerCase()} exist in the "${namespace}" namespace`}
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            {columns.map((column) => (
              <th
                key={column}
                className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {resources.map((resource) => (
            <tr
              key={`${resource.namespace}/${resource.name}`}
              className="hover:bg-muted/30 transition-colors"
            >
              {columns.map((column) => (
                <td key={column} className="px-4 py-3 text-sm">
                  {getCellValue(resource, column)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
