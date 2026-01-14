import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { queryCluster } from '../../api/query'
import { analyzeIssue } from '../../api/remediate'
import { operateCluster } from '../../api/operate'
import { submitRecommendIntent, isSolutionsResponse } from '../../api/recommend'
import { useActionSelection, type SelectedResource, type Tool } from '../../context/ActionSelectionContext'

export type { Tool }

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
 * Returns YAML-like formatted lines (without header prefix)
 */
function extractUrlContext(
  routeParams: Record<string, string | undefined>,
  searchParams: URLSearchParams
): string {
  const lines: string[] = []

  // Process route params (from resource detail page)
  // Route: /dashboard/:group/:version/:kind/:namespace/:name
  if (routeParams.kind) {
    lines.push(`kind: ${routeParams.kind}`)
  }
  // Include group only for non-core resources (CRDs)
  if (routeParams.group && routeParams.group !== '_core') {
    lines.push(`group: ${routeParams.group}`)
  }
  if (routeParams.namespace && routeParams.namespace !== '_cluster') {
    lines.push(`namespace: ${routeParams.namespace}`)
  }
  if (routeParams.name) {
    lines.push(`name: ${routeParams.name}`)
  }

  // Process query params (from resource list page)
  searchParams.forEach((value, key) => {
    if (EXCLUDED_PARAMS.has(key)) return
    // Skip if already added from route params
    if (routeParams[key]) return

    const label = PARAM_LABELS[key] || key
    lines.push(`${label}: ${value}`)
  })

  return lines.join('\n')
}

/**
 * Build context string from selected resources
 * Uses YAML array format for multiple resources
 */
function buildSelectionContext(selectedItems: SelectedResource[]): string {
  if (selectedItems.length === 0) return ''

  if (selectedItems.length === 1) {
    // Single resource - simple format
    const item = selectedItems[0]
    const group = item.apiVersion.includes('/') ? item.apiVersion.split('/')[0] : null
    const lines: string[] = []
    lines.push(`kind: ${item.kind}`)
    if (group) {
      lines.push(`group: ${group}`)
    }
    if (item.namespace) {
      lines.push(`namespace: ${item.namespace}`)
    }
    lines.push(`name: ${item.name}`)
    return lines.join('\n')
  }

  // Multiple resources - array format
  const lines: string[] = ['resources:']

  for (const item of selectedItems) {
    const group = item.apiVersion.includes('/') ? item.apiVersion.split('/')[0] : null

    lines.push(`  - kind: ${item.kind}`)
    if (group) {
      lines.push(`    group: ${group}`)
    }
    if (item.namespace) {
      lines.push(`    namespace: ${item.namespace}`)
    }
    lines.push(`    name: ${item.name}`)
  }

  return lines.join('\n')
}

/**
 * Get tool-specific placeholder text for the intent field
 * Changes based on whether resources are selected
 */
function getIntentPlaceholder(tool: Tool, hasResources: boolean): string {
  if (hasResources) {
    switch (tool) {
      case 'query':
        return 'What would you like to know about these resources?'
      case 'remediate':
        return 'Describe the issue to fix...'
      case 'operate':
        return 'Describe the operation (e.g., scale to 5, update image, rollback)...'
      case 'recommend':
        return 'What would you like to deploy?'
    }
  } else {
    switch (tool) {
      case 'query':
        return 'Ask about the cluster (e.g., show all failing pods, list deployments)...'
      case 'remediate':
        return 'Describe the issue to fix (e.g., fix crashing pods in namespace X)...'
      case 'operate':
        return 'Describe the operation (e.g., scale nginx deployment to 5 replicas)...'
      case 'recommend':
        return 'What would you like to deploy?'
    }
  }
}

interface ToolOption {
  id: Tool
  label: string
  disabled: boolean
  description: string
}

const TOOLS: ToolOption[] = [
  {
    id: 'query',
    label: 'Query',
    disabled: false,
    description: 'Ask questions about resources',
  },
  {
    id: 'remediate',
    label: 'Remediate',
    disabled: false,
    description: 'AI-powered issue resolution',
  },
  {
    id: 'operate',
    label: 'Operate',
    disabled: false,
    description: 'Day 2 operations (scale, update, rollback)',
  },
  {
    id: 'recommend',
    label: 'Recommend',
    disabled: false,
    description: 'AI-powered deployment recommendations',
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

  // Get selected items and tool from action selection context
  const { selectedItems, selectedTool, setSelectedTool } = useActionSelection()

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

  const [resources, setResources] = useState(activeContext)
  const [intent, setIntent] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const resourcesRef = useRef<HTMLTextAreaElement>(null)
  const intentRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const currentTool = TOOLS.find((t) => t.id === selectedTool)!

  // Get sidebar state from URL for preserving across navigation
  const sidebarCollapsed = searchParams.get('sb') === '1'

  // Update resources when context changes
  useEffect(() => {
    setResources(activeContext)
  }, [activeContext])

  // Auto-resize textareas to fit content
  const adjustTextareaHeight = (textarea: HTMLTextAreaElement | null, maxHeight: number) => {
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`
    }
  }

  useEffect(() => {
    adjustTextareaHeight(resourcesRef.current, 100)
  }, [resources])

  useEffect(() => {
    adjustTextareaHeight(intentRef.current, 100)
  }, [intent])

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

  /**
   * Combine resources and intent into a single string for MCP
   * Intent first (primary), then resources as context
   */
  function buildMcpInput(): string {
    const parts: string[] = []

    if (intent.trim()) {
      parts.push(intent.trim())
    }

    if (resources.trim()) {
      if (parts.length > 0) {
        parts.push('')  // Empty line separator
        parts.push('Resources:')
      }
      // Indent resources for clarity
      const indented = resources.trim().split('\n').map(line => `  ${line}`).join('\n')
      parts.push(indented)
    }

    return parts.join('\n')
  }

  // Check if we can submit
  // Recommend only needs intent (no resources), other tools need at least one field
  const canSubmit = selectedTool === 'recommend'
    ? intent.trim() && !currentTool.disabled
    : (resources.trim() || intent.trim()) && !currentTool.disabled

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()

    if (!canSubmit || isLoading) return

    const mcpInput = buildMcpInput()

    if (selectedTool === 'query') {
      setIsLoading(true)
      setError(null)

      abortControllerRef.current = new AbortController()

      try {
        const result = await queryCluster(mcpInput, abortControllerRef.current.signal)

        if (result.sessionId) {
          const sidebarParam = sidebarCollapsed ? '?sb=1' : '?sb=0'
          setIntent('')  // Clear input after successful submission
          navigate(`/v/${result.sessionId}${sidebarParam}`)
        }
      } catch (err) {
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

      abortControllerRef.current = new AbortController()

      try {
        const result = await analyzeIssue(mcpInput, abortControllerRef.current.signal)

        if (result.sessionId) {
          const sidebarParam = sidebarCollapsed ? '?sb=1' : '?sb=0'
          setIntent('')  // Clear input after successful submission
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
    } else if (selectedTool === 'operate') {
      setIsLoading(true)
      setError(null)

      abortControllerRef.current = new AbortController()

      try {
        const result = await operateCluster(mcpInput, abortControllerRef.current.signal)

        if (result.sessionId) {
          const sidebarParam = sidebarCollapsed ? '?sb=1' : '?sb=0'
          setIntent('')  // Clear input after successful submission
          navigate(`/v/${result.sessionId}${sidebarParam}`, {
            state: { operateData: result }
          })
        }
      } catch (err) {
        if (err instanceof Error && err.message === 'Request cancelled') {
          // Silently handle cancellation
        } else {
          const message = err instanceof Error ? err.message : 'An error occurred'
          setError(message)
          console.error('[ActionBar] Operate error:', err)
        }
      } finally {
        setIsLoading(false)
        abortControllerRef.current = null
      }
    } else if (selectedTool === 'recommend') {
      setIsLoading(true)
      setError(null)

      abortControllerRef.current = new AbortController()

      try {
        // Submit intent with final=true to get solutions directly
        const result = await submitRecommendIntent(mcpInput, true, abortControllerRef.current.signal)

        // Check if we got solutions (not refinement)
        if (isSolutionsResponse(result)) {
          // Use the first solution's ID for the session URL
          const firstSolutionId = result.solutions[0]?.solutionId
          if (firstSolutionId) {
            const sidebarParam = sidebarCollapsed ? '?sb=1' : '?sb=0'
            setIntent('')  // Clear input after successful submission
            navigate(`/v/${firstSolutionId}${sidebarParam}`, {
              state: { recommendData: result }
            })
          }
        } else {
          // Got refinement guidance - show as error for now
          // (Future: could show inline guidance)
          setError(result.guidance || 'Please provide more details about what you want to deploy.')
        }
      } catch (err) {
        if (err instanceof Error && err.message === 'Request cancelled') {
          // Silently handle cancellation
        } else {
          const message = err instanceof Error ? err.message : 'An error occurred'
          setError(message)
          console.error('[ActionBar] Recommend error:', err)
        }
      } finally {
        setIsLoading(false)
        abortControllerRef.current = null
      }
    }
  }

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsLoading(false)
    }
  }

  const handleToolSelect = (tool: Tool) => {
    const toolOption = TOOLS.find((t) => t.id === tool)
    if (toolOption && !toolOption.disabled) {
      setSelectedTool(tool)  // Context handles clearing selection for recommend
      setIsDropdownOpen(false)
      setError(null)
      // Clear resources field when switching to Recommend (resources don't apply)
      if (tool === 'recommend') {
        setResources('')
      }
      // Focus intent field after tool change
      setTimeout(() => {
        intentRef.current?.focus()
      }, 0)
    }
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
        <div className="flex items-start gap-3">
          {/* Tool selector dropdown */}
          <div className="relative flex-shrink-0" ref={dropdownRef}>
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

            {/* Dropdown menu */}
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

          {/* Resources field - shows context (disabled for Recommend) */}
          <div className="flex-shrink-0 w-80">
            <textarea
              ref={resourcesRef}
              value={selectedTool === 'recommend' ? '' : resources}
              onChange={(e) => setResources(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading || selectedTool === 'recommend'}
              rows={1}
              placeholder={selectedTool === 'recommend' ? 'Not applicable' : 'No resources selected'}
              className={`w-full px-3 py-2 bg-muted/50 border border-border rounded-md text-xs text-muted-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none overflow-y-auto disabled:opacity-50 ${
                selectedTool === 'recommend' ? 'cursor-not-allowed' : ''
              }`}
            />
          </div>

          {/* Intent field - user types their question/command */}
          <textarea
            ref={intentRef}
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={1}
            placeholder={getIntentPlaceholder(selectedTool, !!resources.trim())}
            className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none overflow-hidden disabled:opacity-50"
          />

          {/* Submit/Cancel button */}
          {isLoading ? (
            <button
              type="button"
              onClick={handleCancel}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-red-500/80 text-white rounded-md text-sm font-medium hover:bg-red-500 transition-colors"
            >
              <LoadingSpinner />
              <span>Cancel</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-shrink-0 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
