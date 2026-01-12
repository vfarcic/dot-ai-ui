import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { queryCluster } from '../../api/query'
import { analyzeIssue } from '../../api/remediate'
import { useActionSelection, type SelectedResource } from '../../context/ActionSelectionContext'

export type Tool = 'query' | 'remediate' | 'operate' | 'recommend'

// Internal/UI params to exclude from context (version is redundant - group is more meaningful for CRDs)
const EXCLUDED_PARAMS = new Set(['sb', 'tab', 'version'])

// Friendly labels for param keys
const PARAM_LABELS: Record<string, string> = {
  ns: 'namespace',
  kind: 'kind',
  group: 'group',
  name: 'name',
}

/**
 * Extract context from URL params (both route and query params)
 * Returns a YAML-like formatted string
 */
function extractUrlContext(
  routeParams: Record<string, string | undefined>,
  searchParams: URLSearchParams
): string {
  const lines: string[] = []

  // Process route params (from resource detail page)
  // Route: /dashboard/:group/:version/:kind/:namespace/:name
  if (routeParams.kind) {
    lines.push(`  kind: ${routeParams.kind}`)
  }
  // Include group only for non-core resources (CRDs)
  if (routeParams.group && routeParams.group !== '_core') {
    lines.push(`  group: ${routeParams.group}`)
  }
  if (routeParams.namespace && routeParams.namespace !== '_cluster') {
    lines.push(`  namespace: ${routeParams.namespace}`)
  }
  if (routeParams.name) {
    lines.push(`  name: ${routeParams.name}`)
  }

  // Process query params (from resource list page)
  searchParams.forEach((value, key) => {
    if (EXCLUDED_PARAMS.has(key)) return
    // Skip if already added from route params
    if (routeParams[key]) return

    const label = PARAM_LABELS[key] || key
    lines.push(`  ${label}: ${value}`)
  })

  if (lines.length === 0) return ''
  return 'Analyze:\n' + lines.join('\n')
}

/**
 * Build context string from selected resources
 * Uses multi-line YAML-like format for readability
 */
function buildSelectionContext(selectedItems: SelectedResource[]): string {
  if (selectedItems.length === 0) return ''

  // Group items by kind and apiVersion
  const byKind = selectedItems.reduce((acc, item) => {
    const key = `${item.kind}|${item.apiVersion}`
    if (!acc[key]) {
      acc[key] = { kind: item.kind, apiVersion: item.apiVersion, items: [] }
    }
    acc[key].items.push(item)
    return acc
  }, {} as Record<string, { kind: string; apiVersion: string; items: SelectedResource[] }>)

  const groups = Object.values(byKind)
  const lines: string[] = ['Analyze:']

  for (const { kind, apiVersion, items } of groups) {
    const namespaces = [...new Set(items.map((i) => i.namespace).filter(Boolean))]
    // Extract group from apiVersion (e.g., "apps/v1" -> "apps", "v1" -> null)
    const group = apiVersion.includes('/') ? apiVersion.split('/')[0] : null

    lines.push(`  kind: ${kind}`)
    if (group) {
      lines.push(`  group: ${group}`)
    }
    if (namespaces.length === 1) {
      lines.push(`  namespace: ${namespaces[0]}`)
    } else if (namespaces.length > 1) {
      lines.push(`  namespaces: ${namespaces.join(', ')}`)
    }
    if (items.length === 1) {
      lines.push(`  name: ${items[0].name}`)
    } else {
      lines.push('  names:')
      items.forEach((item) => lines.push(`    - ${item.name}`))
    }
  }

  return lines.join('\n')
}

/**
 * Build tool-specific default text using context (from selection or URL)
 * Context is already in YAML format starting with "Analyze:" or similar
 */
function getToolDefaultText(tool: Tool, context: string): string {
  if (!context) {
    // No context - use generic defaults
    switch (tool) {
      case 'query': return 'Analyze cluster health'
      case 'remediate': return 'Describe the issue to fix'
      case 'operate': return 'What operation do you want to perform?'
      case 'recommend': return 'What do you want to deploy?'
    }
  }

  // Context already has the action prefix (Analyze:, Fix:, etc.)
  // Just replace the prefix based on tool
  switch (tool) {
    case 'query': return context // Already starts with "Analyze:"
    case 'remediate': return context.replace(/^Analyze:/, 'Fix issues with:')
    case 'operate': return context.replace(/^Analyze:/, 'Operate on:')
    case 'recommend': return context.replace(/^Analyze:/, 'Recommend for:')
  }
}

interface ToolOption {
  id: Tool
  label: string
  defaultText: string
  disabled: boolean
  description: string
}

const TOOLS: ToolOption[] = [
  {
    id: 'query',
    label: 'Query',
    defaultText: 'Analyze cluster health',
    disabled: false,
    description: 'Ask questions about resources',
  },
  {
    id: 'remediate',
    label: 'Remediate',
    defaultText: 'Describe the issue to fix',
    disabled: false,
    description: 'AI-powered issue resolution',
  },
  {
    id: 'operate',
    label: 'Operate',
    defaultText: 'What operation do you want to perform?',
    disabled: true,
    description: 'Day 2 operations (scale, update, rollback)',
  },
  {
    id: 'recommend',
    label: 'Recommend',
    defaultText: 'What do you want to deploy?',
    disabled: true,
    description: 'Deployment recommendations',
  },
]

// Loading spinner component
function LoadingSpinner() {
  return (
    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

export function ActionBar() {
  const navigate = useNavigate()
  const routeParams = useParams()
  const [searchParams] = useSearchParams()

  // Get selected items from action selection context
  const { selectedItems } = useActionSelection()

  // Extract context from URL (memoized to avoid recalculation)
  const urlContext = useMemo(
    () => extractUrlContext(routeParams, searchParams),
    [routeParams, searchParams]
  )

  // Build context from selection (if any) or fall back to URL context
  const selectionContext = useMemo(
    () => buildSelectionContext(selectedItems),
    [selectedItems]
  )

  // Use selection context if items are selected, otherwise URL context
  const activeContext = selectionContext || urlContext

  const [selectedTool, setSelectedTool] = useState<Tool>('query')
  const [input, setInput] = useState(() => getToolDefaultText('query', activeContext))
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const currentTool = TOOLS.find((t) => t.id === selectedTool)!

  // Get sidebar state from URL for preserving across navigation
  const sidebarCollapsed = searchParams.get('sb') === '1'

  // Update input when selection or URL context changes
  useEffect(() => {
    setInput(getToolDefaultText(selectedTool, activeContext))
  }, [selectedTool, activeContext])

  // Auto-resize textarea to fit content
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px` // Max 150px
    }
  }

  useEffect(() => {
    adjustTextareaHeight()
  }, [input])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()

    if (!input.trim() || isLoading) return

    if (selectedTool === 'query') {
      setIsLoading(true)
      setError(null)

      // Create new AbortController for this request
      abortControllerRef.current = new AbortController()

      try {
        const result = await queryCluster(input.trim(), abortControllerRef.current.signal)

        // Navigate to visualization page with sessionId
        if (result.sessionId) {
          const sidebarParam = sidebarCollapsed ? '?sb=1' : '?sb=0'
          navigate(`/v/${result.sessionId}${sidebarParam}`)
        }
      } catch (err) {
        // Don't show error message for user-initiated cancellation
        if (err instanceof Error && err.message === 'Request cancelled') {
          // Silently handle cancellation
        } else {
          const message = err instanceof Error ? err.message : 'An error occurred'
          setError(message)
          console.error('[ActionBar] Query error:', err)
        }
      } finally {
        setIsLoading(false)
        abortControllerRef.current = null
      }
    } else if (selectedTool === 'remediate') {
      setIsLoading(true)
      setError(null)

      // Create new AbortController for this request
      abortControllerRef.current = new AbortController()

      try {
        const result = await analyzeIssue(input.trim(), abortControllerRef.current.signal)

        // Navigate to visualization page with sessionId
        // Pass remediate data via navigation state for immediate display
        if (result.sessionId) {
          const sidebarParam = sidebarCollapsed ? '?sb=1' : '?sb=0'
          navigate(`/v/${result.sessionId}${sidebarParam}`, {
            state: { remediateData: result }
          })
        }
      } catch (err) {
        if (err instanceof Error && err.message === 'Request cancelled') {
          // Silently handle cancellation
        } else {
          const message = err instanceof Error ? err.message : 'An error occurred'
          setError(message)
          console.error('[ActionBar] Remediate error:', err)
        }
      } finally {
        setIsLoading(false)
        abortControllerRef.current = null
      }
    }
    // Other tools (operate, recommend) will be handled when implemented
  }

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      // Immediately clear the controller and reset loading state
      abortControllerRef.current = null
      setIsLoading(false)
    }
  }

  const handleToolSelect = (tool: Tool) => {
    const toolOption = TOOLS.find((t) => t.id === tool)
    if (toolOption && !toolOption.disabled) {
      setSelectedTool(tool)
      // Use context-aware default text for the selected tool
      setInput(getToolDefaultText(tool, activeContext))
      setIsDropdownOpen(false)
      setError(null)
      // Select all text so user can easily replace it
      setTimeout(() => {
        textareaRef.current?.select()
      }, 0)
    }
  }

  const handleTextareaFocus = () => {
    // Select all text on focus for easy replacement
    textareaRef.current?.select()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-header-bg border-t border-border px-4 py-3 z-50">
      {/* Error message */}
      {error && (
        <div className="mb-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-md text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-3">
          {/* Tool selector dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-2 bg-muted border border-border rounded-md text-sm font-medium text-foreground hover:bg-muted/80 transition-colors min-w-[120px] disabled:opacity-50"
            >
              <span>{currentTool.label}</span>
              <svg
                className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown menu - matches dashboard body styling */}
            {isDropdownOpen && (
              <div className="absolute bottom-full left-0 mb-1 w-56 bg-background border border-border rounded-md shadow-lg py-1">
                {TOOLS.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => handleToolSelect(tool.id)}
                    disabled={tool.disabled}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      tool.disabled
                        ? 'cursor-not-allowed'
                        : tool.id === selectedTool
                          ? 'bg-primary/20'
                          : 'hover:bg-primary/10'
                    }`}
                  >
                    <div className={`font-medium ${
                      tool.disabled
                        ? 'text-muted-foreground'
                        : tool.id === selectedTool
                          ? 'text-primary'
                          : 'text-foreground'
                    }`}>{tool.label}</div>
                    <div className={`text-xs ${tool.disabled ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>{tool.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Textarea - pre-populated with default text, auto-expands */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={handleTextareaFocus}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={1}
            className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none overflow-hidden disabled:opacity-50"
          />

          {/* Submit/Cancel button */}
          {isLoading ? (
            <button
              type="button"
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/80 text-white rounded-md text-sm font-medium hover:bg-red-500 transition-colors"
            >
              <LoadingSpinner />
              <span>Cancel</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || currentTool.disabled}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
