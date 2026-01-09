import { useState, useCallback } from 'react'

interface CollapsibleTreeProps {
  data: unknown
  initialExpandLevel?: number // How many levels to expand by default (0 = collapse all, 1 = expand first level, etc.)
  className?: string
}

interface TreeNodeProps {
  label: string
  value: unknown
  depth: number
  initialExpandLevel: number
  isArrayItem?: boolean
}

/**
 * Render a single tree node with its children
 */
function TreeNode({ label, value, depth, initialExpandLevel, isArrayItem }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < initialExpandLevel)

  const toggleExpand = useCallback(() => setExpanded((prev) => !prev), [])

  const indent = depth * 16 // 16px per level

  // Handle null/undefined
  if (value === null || value === undefined) {
    return (
      <div style={{ paddingLeft: indent }} className="py-0.5 flex items-start gap-2">
        <span className="text-muted-foreground font-medium min-w-0">{label}:</span>
        <span className="text-muted-foreground/60 italic">null</span>
      </div>
    )
  }

  // Handle arrays
  if (Array.isArray(value)) {
    const isEmpty = value.length === 0
    return (
      <div>
        <div
          style={{ paddingLeft: indent }}
          className={`py-0.5 flex items-center gap-1 ${!isEmpty ? 'cursor-pointer hover:bg-muted/50 rounded' : ''}`}
          onClick={!isEmpty ? toggleExpand : undefined}
        >
          {!isEmpty && (
            <span className="text-muted-foreground w-4 flex-shrink-0">
              {expanded ? '▼' : '▶'}
            </span>
          )}
          <span className="text-muted-foreground font-medium">{label}</span>
          <span className="text-muted-foreground/60 text-xs">
            [{value.length} {value.length === 1 ? 'item' : 'items'}]
          </span>
        </div>
        {expanded && !isEmpty && (
          <div>
            {value.map((item, index) => (
              <TreeNode
                key={index}
                label={`[${index}]`}
                value={item}
                depth={depth + 1}
                initialExpandLevel={initialExpandLevel}
                isArrayItem
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Handle objects
  if (typeof value === 'object') {
    const entries = Object.entries(value)
    const isEmpty = entries.length === 0
    return (
      <div>
        <div
          style={{ paddingLeft: indent }}
          className={`py-0.5 flex items-center gap-1 ${!isEmpty ? 'cursor-pointer hover:bg-muted/50 rounded' : ''}`}
          onClick={!isEmpty ? toggleExpand : undefined}
        >
          {!isEmpty && (
            <span className="text-muted-foreground w-4 flex-shrink-0">
              {expanded ? '▼' : '▶'}
            </span>
          )}
          <span className={`font-medium ${isArrayItem ? 'text-blue-400' : 'text-muted-foreground'}`}>
            {label}
          </span>
          {isEmpty && <span className="text-muted-foreground/60 text-xs">{'{}'}</span>}
          {!isEmpty && !expanded && (
            <span className="text-muted-foreground/60 text-xs">
              {'{'}...{'}'}
            </span>
          )}
        </div>
        {expanded && !isEmpty && (
          <div>
            {entries.map(([key, val]) => (
              <TreeNode
                key={key}
                label={key}
                value={val}
                depth={depth + 1}
                initialExpandLevel={initialExpandLevel}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Handle primitives (string, number, boolean)
  const valueColor = getValueColor(value)

  return (
    <div style={{ paddingLeft: indent }} className="py-0.5 flex items-start gap-2">
      <span className="text-muted-foreground font-medium min-w-0 flex-shrink-0">{label}:</span>
      <span className={`${valueColor} break-all`}>{formatValue(value)}</span>
    </div>
  )
}

/**
 * Get color class based on value type
 */
function getValueColor(value: unknown): string {
  if (typeof value === 'string') return 'text-green-400'
  if (typeof value === 'number') return 'text-blue-400'
  if (typeof value === 'boolean') return value ? 'text-yellow-400' : 'text-red-400'
  return 'text-foreground'
}

/**
 * Format a primitive value for display
 */
function formatValue(value: unknown): string {
  if (typeof value === 'string') return `"${value}"`
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

/**
 * CollapsibleTree - Render nested objects/arrays as an expandable tree
 */
export function CollapsibleTree({
  data,
  initialExpandLevel = 1,
  className = '',
}: CollapsibleTreeProps) {
  if (data === null || data === undefined) {
    return <div className={`text-muted-foreground/60 italic ${className}`}>No data</div>
  }

  // If data is not an object/array, render as single value
  if (typeof data !== 'object') {
    return <div className={className}>{formatValue(data)}</div>
  }

  // Render object entries
  const entries = Object.entries(data)
  if (entries.length === 0) {
    return <div className={`text-muted-foreground/60 italic ${className}`}>Empty</div>
  }

  return (
    <div className={`font-mono text-sm ${className}`}>
      {entries.map(([key, value]) => (
        <TreeNode
          key={key}
          label={key}
          value={value}
          depth={0}
          initialExpandLevel={initialExpandLevel}
        />
      ))}
    </div>
  )
}
