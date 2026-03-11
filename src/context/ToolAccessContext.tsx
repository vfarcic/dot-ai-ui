import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from '../auth/AuthContext'
import { getAllowedTools } from '../api/tools'

interface ToolAccessContextType {
  /** Whether the tool access list is still loading */
  isLoading: boolean
  /** Set of tool IDs the current user is allowed to use */
  allowedTools: Set<string>
  /** Check if a specific tool is allowed */
  isToolAllowed: (toolId: string) => boolean
}

const ToolAccessContext = createContext<ToolAccessContextType | null>(null)

export function ToolAccessProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, authMode } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [allowedTools, setAllowedTools] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoading(false)
      return
    }

    // Static token users bypass RBAC — all tools allowed
    if (authMode === 'token' || !authMode) {
      setAllowedTools(new Set(['query', 'remediate', 'operate', 'recommend', 'users']))
      setIsLoading(false)
      return
    }

    // OAuth users — fetch allowed tools from MCP server
    async function fetchTools() {
      try {
        const tools = await getAllowedTools()
        const toolIds = new Set(tools.map((t) => t.name))
        setAllowedTools(toolIds)
      } catch (err) {
        console.error('[ToolAccess] Failed to fetch allowed tools:', err)
        // On error, default to showing all tools (server-side will still enforce)
        setAllowedTools(new Set(['query', 'remediate', 'operate', 'recommend', 'users']))
      } finally {
        setIsLoading(false)
      }
    }

    fetchTools()
  }, [isAuthenticated, authMode])

  const isToolAllowed = useCallback(
    (toolId: string) => isLoading || allowedTools.has(toolId),
    [isLoading, allowedTools]
  )

  return (
    <ToolAccessContext.Provider value={{ isLoading, allowedTools, isToolAllowed }}>
      {children}
    </ToolAccessContext.Provider>
  )
}

export function useToolAccess(): ToolAccessContextType {
  const context = useContext(ToolAccessContext)
  if (!context) {
    throw new Error('useToolAccess must be used within a ToolAccessProvider')
  }
  return context
}
