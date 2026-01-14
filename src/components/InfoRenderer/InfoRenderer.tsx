/**
 * Config-driven renderer for structured information
 * Takes a template and data, renders the appropriate blocks
 */

import { useState } from 'react'
import type {
  InfoTemplate,
  InfoBlock,
  HeadingBlock,
  TextBlock,
  ListBlock,
  CodeBlock,
  KeyValueBlock,
  ActionsListBlock,
  ChangesListBlock,
  CodeListBlock,
  Severity,
  BadgeConfig,
} from './types'
import { getFieldValue } from './types'

interface InfoRendererProps {
  template: InfoTemplate
  data: Record<string, unknown>
}

function getSeverityStyles(severity?: Severity): string {
  switch (severity) {
    case 'error':
      return 'text-red-400 border-red-500/30'
    case 'warning':
      return 'text-yellow-400 border-yellow-500/30'
    case 'success':
      return 'text-green-400 border-green-500/30'
    case 'info':
    default:
      return 'text-muted-foreground border-border'
  }
}

function getSeverityBullet(severity?: Severity): string {
  switch (severity) {
    case 'error':
      return 'text-red-400'
    case 'warning':
      return 'text-yellow-400'
    case 'success':
      return 'text-green-400'
    default:
      return 'text-muted-foreground'
  }
}

function formatBadgeValue(value: unknown, format?: BadgeConfig['format']): string {
  if (value === null || value === undefined) return ''

  switch (format) {
    case 'percent':
      const num = typeof value === 'number' ? value : parseFloat(String(value))
      if (isNaN(num)) return String(value)
      // If value > 1, it's already a percentage (e.g., 96), otherwise it's decimal (e.g., 0.96)
      const percentValue = num > 1 ? Math.round(num) : Math.round(num * 100)
      return `${percentValue}%`
    case 'risk':
      const risk = String(value).toLowerCase()
      return risk.charAt(0).toUpperCase() + risk.slice(1) + ' Risk'
    case 'text':
    default:
      return String(value)
  }
}

function getBadgeStyles(value: unknown, format?: BadgeConfig['format']): string {
  if (format === 'percent') {
    const num = typeof value === 'number' ? value : parseFloat(String(value))
    if (!isNaN(num)) {
      // Normalize to 0-100 scale for comparison
      const normalized = num > 1 ? num : num * 100
      if (normalized >= 90) return 'bg-green-500/20 text-green-400'
      if (normalized >= 70) return 'bg-yellow-500/20 text-yellow-400'
      return 'bg-red-500/20 text-red-400'
    }
  }
  if (format === 'risk') {
    const risk = String(value).toLowerCase()
    if (risk === 'low') return 'bg-green-500/20 text-green-400'
    if (risk === 'medium') return 'bg-yellow-500/20 text-yellow-400'
    if (risk === 'high') return 'bg-red-500/20 text-red-400'
  }
  return 'bg-primary/20 text-primary'
}

function HeadingRenderer({ block, data }: { block: HeadingBlock; data: Record<string, unknown> }) {
  const badgeValue = block.badge ? getFieldValue(data, block.badge.field) : null
  const level = block.level || 2

  const HeadingTag = `h${level}` as 'h1' | 'h2' | 'h3'
  const sizeClass = level === 1 ? 'text-lg' : level === 2 ? 'text-base' : 'text-sm'

  return (
    <div className="flex items-center gap-2 mb-2">
      <HeadingTag className={`font-semibold ${sizeClass}`}>{block.text}</HeadingTag>
      {badgeValue !== null && badgeValue !== undefined && (
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${getBadgeStyles(badgeValue, block.badge?.format)}`}
        >
          {formatBadgeValue(badgeValue, block.badge?.format)}
        </span>
      )}
    </div>
  )
}

function TextRenderer({ block, data }: { block: TextBlock; data: Record<string, unknown> }) {
  const value = getFieldValue(data, block.field)
  if (value === null || value === undefined) return null

  return (
    <p className={`text-sm mb-3 ${getSeverityStyles(block.severity)}`}>
      {String(value)}
    </p>
  )
}

function ListRenderer({ block, data }: { block: ListBlock; data: Record<string, unknown> }) {
  const value = getFieldValue(data, block.field)
  if (!Array.isArray(value) || value.length === 0) return null

  return (
    <ul className="list-none space-y-1 mb-3">
      {value.map((item, index) => (
        <li key={index} className="flex items-start gap-2 text-sm">
          <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${getSeverityBullet(block.severity)} bg-current`} />
          <span className={getSeverityStyles(block.severity)}>{String(item)}</span>
        </li>
      ))}
    </ul>
  )
}

function CodeRenderer({ block, data }: { block: CodeBlock; data: Record<string, unknown> }) {
  const value = getFieldValue(data, block.field)
  if (value === null || value === undefined) return null

  return (
    <pre className="text-sm bg-muted p-3 rounded-md overflow-x-auto mb-3 font-mono">
      <code>{String(value)}</code>
    </pre>
  )
}

function KeyValueRenderer({ block, data }: { block: KeyValueBlock; data: Record<string, unknown> }) {
  return (
    <div className="space-y-1 mb-3">
      {block.items.map((item, index) => {
        const value = getFieldValue(data, item.field)
        if (value === null || value === undefined) return null

        return (
          <div key={index} className="flex items-baseline gap-2 text-sm">
            <span className="text-muted-foreground font-medium min-w-[100px]">{item.label}:</span>
            <span className={getSeverityStyles(item.severity)}>{String(value)}</span>
          </div>
        )
      })}
    </div>
  )
}

interface RemediationAction {
  description: string
  command: string
  risk: string
  rationale?: string
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors cursor-pointer"
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-green-400">Copied!</span>
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>Copy</span>
        </>
      )}
    </button>
  )
}

function ActionsListRenderer({ block, data }: { block: ActionsListBlock; data: Record<string, unknown> }) {
  const value = getFieldValue(data, block.field)
  if (!Array.isArray(value) || value.length === 0) return null

  const actions = value as RemediationAction[]

  return (
    <div className="space-y-3 mb-3">
      {actions.map((action, index) => (
        <div
          key={index}
          className="p-3 rounded-md border border-border bg-muted/30"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="font-medium text-sm">{action.description}</span>
            {block.showRisk && action.risk && (
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${getBadgeStyles(action.risk, 'risk')}`}
              >
                {action.risk} risk
              </span>
            )}
          </div>
          {block.showCommand && action.command && (
            <div className="relative group">
              <pre className="text-xs bg-background p-2 pr-16 rounded overflow-x-auto font-mono text-muted-foreground">
                {action.command}
              </pre>
              <div className="absolute top-1 right-1">
                <CopyButton text={action.command} />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * Proposed change item for Operate tool
 */
interface ProposedChange {
  kind: string
  name: string
  manifest?: string
  rationale: string
}

interface ProposedChanges {
  create?: ProposedChange[]
  update?: ProposedChange[]
  delete?: ProposedChange[]
}

/**
 * Collapsible section for a single proposed change
 */
function ChangeItem({ change, type }: { change: ProposedChange; type: 'create' | 'update' | 'delete' }) {
  const [isExpanded, setIsExpanded] = useState(false)

  const typeStyles = {
    create: 'border-l-green-500 bg-green-500/5',
    update: 'border-l-yellow-500 bg-yellow-500/5',
    delete: 'border-l-red-500 bg-red-500/5',
  }

  const typeLabels = {
    create: 'Create',
    update: 'Update',
    delete: 'Delete',
  }

  const typeBadgeStyles = {
    create: 'bg-green-500/20 text-green-400',
    update: 'bg-yellow-500/20 text-yellow-400',
    delete: 'bg-red-500/20 text-red-400',
  }

  return (
    <div className={`border-l-2 rounded-r-md ${typeStyles[type]}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center justify-between gap-2 hover:bg-muted/30 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 text-left">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeBadgeStyles[type]}`}>
            {typeLabels[type]}
          </span>
          <span className="font-medium text-sm">{change.kind}</span>
          <span className="text-muted-foreground text-sm">{change.name}</span>
        </div>
        <svg
          className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          <p className="text-sm text-muted-foreground">{change.rationale}</p>
          {change.manifest && (
            <div className="relative">
              <pre className="text-xs bg-background p-3 pr-16 rounded overflow-x-auto font-mono text-muted-foreground max-h-80 overflow-y-auto">
                {change.manifest}
              </pre>
              <div className="absolute top-2 right-2">
                <CopyButton text={change.manifest} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ChangesListRenderer({ block, data }: { block: ChangesListBlock; data: Record<string, unknown> }) {
  const value = getFieldValue(data, block.field) as ProposedChanges | null
  if (!value) return null

  const { create = [], update = [], delete: deleteChanges = [] } = value
  const hasChanges = create.length > 0 || update.length > 0 || deleteChanges.length > 0

  if (!hasChanges) {
    return (
      <p className="text-sm text-muted-foreground mb-3">No changes proposed.</p>
    )
  }

  return (
    <div className="space-y-2 mb-3">
      {create.map((change, index) => (
        <ChangeItem key={`create-${index}`} change={change} type="create" />
      ))}
      {update.map((change, index) => (
        <ChangeItem key={`update-${index}`} change={change} type="update" />
      ))}
      {deleteChanges.map((change, index) => (
        <ChangeItem key={`delete-${index}`} change={change} type="delete" />
      ))}
    </div>
  )
}

function CodeListRenderer({ block, data }: { block: CodeListBlock; data: Record<string, unknown> }) {
  const value = getFieldValue(data, block.field)
  if (!Array.isArray(value) || value.length === 0) return null

  return (
    <div className="space-y-2 mb-3">
      {value.map((command, index) => (
        <div key={index} className="relative">
          <pre className="text-xs bg-muted p-3 pr-16 rounded overflow-x-auto font-mono text-muted-foreground">
            {String(command)}
          </pre>
          <div className="absolute top-2 right-2">
            <CopyButton text={String(command)} />
          </div>
        </div>
      ))}
    </div>
  )
}

function BlockRenderer({ block, data }: { block: InfoBlock; data: Record<string, unknown> }) {
  switch (block.type) {
    case 'heading':
      return <HeadingRenderer block={block} data={data} />
    case 'text':
      return <TextRenderer block={block} data={data} />
    case 'list':
      return <ListRenderer block={block} data={data} />
    case 'code':
      return <CodeRenderer block={block} data={data} />
    case 'key-value':
      return <KeyValueRenderer block={block} data={data} />
    case 'actions-list':
      return <ActionsListRenderer block={block} data={data} />
    case 'changes-list':
      return <ChangesListRenderer block={block} data={data} />
    case 'code-list':
      return <CodeListRenderer block={block} data={data} />
    default:
      return null
  }
}

export function InfoRenderer({ template, data }: InfoRendererProps) {
  return (
    <div className="space-y-1">
      {template.map((block, index) => (
        <BlockRenderer key={index} block={block} data={data} />
      ))}
    </div>
  )
}
