import { useState, useEffect } from 'react'
import { mcpClient, APIError } from '@/api'
import type { MCPVisualizationResponse, Visualization } from '@/types'

interface Message {
  role: 'user' | 'assistant'
  content: string
  visualizations?: Visualization[]
  error?: string
}

export function Chat() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking')

  // Check API connection on mount
  useEffect(() => {
    checkConnection()
  }, [])

  async function checkConnection() {
    setConnectionStatus('checking')
    try {
      await mcpClient.version()
      setConnectionStatus('connected')
    } catch {
      setConnectionStatus('disconnected')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    try {
      const response: MCPVisualizationResponse = await mcpClient.recommend({
        intent: userMessage,
      })

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.message,
          visualizations: response.visualizations,
        },
      ])
    } catch (error) {
      const errorMessage = error instanceof APIError
        ? `Error: ${error.message}`
        : 'An unexpected error occurred'

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: errorMessage,
          error: errorMessage,
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Connection status indicator */}
      <div className="flex items-center gap-2 pb-2 text-sm">
        <span
          className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected'
              ? 'bg-green-500'
              : connectionStatus === 'checking'
              ? 'bg-yellow-500 animate-pulse'
              : 'bg-red-500'
          }`}
        />
        <span className="text-muted-foreground">
          {connectionStatus === 'connected'
            ? 'Connected to MCP Server'
            : connectionStatus === 'checking'
            ? 'Checking connection...'
            : 'Disconnected'}
        </span>
        {connectionStatus === 'disconnected' && (
          <button
            onClick={checkConnection}
            className="text-primary hover:underline"
          >
            Retry
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <p className="mb-2">Start a conversation by typing your intent below</p>
              <p className="text-sm">Examples: &quot;deploy web app&quot;, &quot;setup Redis cache&quot;, &quot;create PostgreSQL database&quot;</p>
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg ${
                message.role === 'user'
                  ? 'bg-primary/10 ml-12'
                  : message.error
                  ? 'bg-red-500/10 mr-12 border border-red-500/20'
                  : 'bg-muted mr-12'
              }`}
            >
              <p className="text-sm font-medium mb-1">
                {message.role === 'user' ? 'You' : 'Assistant'}
              </p>
              <p className="whitespace-pre-wrap">{message.content}</p>
              {/* TODO: Render visualizations */}
            </div>
          ))
        )}
        {isLoading && (
          <div className="p-4 rounded-lg bg-muted mr-12">
            <p className="text-sm font-medium mb-1">Assistant</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex gap-2 pt-4 border-t border-border">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter your intent (e.g., 'deploy web app')"
          disabled={isLoading}
          className="flex-1 px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  )
}
