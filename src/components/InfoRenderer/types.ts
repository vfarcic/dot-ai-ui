/**
 * Config-driven template types for rendering structured information
 * Each tool defines its own template; the renderer is generic
 */

export type InfoBlockType = 'heading' | 'text' | 'list' | 'code' | 'key-value' | 'actions-list' | 'changes-list' | 'code-list'

export type Severity = 'info' | 'warning' | 'error' | 'success'

export interface BadgeConfig {
  field: string
  format?: 'percent' | 'text' | 'risk'
}

export interface HeadingBlock {
  type: 'heading'
  text: string
  badge?: BadgeConfig
  level?: 1 | 2 | 3
}

export interface TextBlock {
  type: 'text'
  field: string
  severity?: Severity
}

export interface ListBlock {
  type: 'list'
  field: string
  severity?: Severity
}

export interface CodeBlock {
  type: 'code'
  field: string
  language?: string
}

export interface KeyValueBlock {
  type: 'key-value'
  items: Array<{
    label: string
    field: string
    severity?: Severity
  }>
}

export interface ActionsListBlock {
  type: 'actions-list'
  field: string
  showCommand?: boolean
  showRisk?: boolean
}

/**
 * Block for displaying proposed changes (create/update/delete)
 * Used by Operate tool to show manifest changes
 */
export interface ChangesListBlock {
  type: 'changes-list'
  field: string
}

/**
 * Block for displaying a list of code snippets (commands)
 * Used by Operate tool to show kubectl commands
 */
export interface CodeListBlock {
  type: 'code-list'
  field: string
  language?: string
}

export type InfoBlock =
  | HeadingBlock
  | TextBlock
  | ListBlock
  | CodeBlock
  | KeyValueBlock
  | ActionsListBlock
  | ChangesListBlock
  | CodeListBlock

export type InfoTemplate = InfoBlock[]

/**
 * Helper to get nested field value from object
 * Supports dot notation: "analysis.rootCause"
 */
export function getFieldValue(data: Record<string, unknown>, field: string): unknown {
  const parts = field.split('.')
  let value: unknown = data

  for (const part of parts) {
    if (value === null || value === undefined) return undefined
    if (typeof value !== 'object') return undefined
    value = (value as Record<string, unknown>)[part]
  }

  return value
}
