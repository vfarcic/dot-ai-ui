import { useState, useEffect } from 'react'
import Markdown from 'react-markdown'
import { askKnowledge, KnowledgeError, type KnowledgeAnswer } from '../../api/knowledge'

interface KnowledgeResultsViewProps {
  query: string
}

function LoadingSkeleton() {
  return (
    <div className="p-6 border-b border-border">
      <div className="mb-3">
        <div className="h-5 w-40 bg-muted/50 rounded animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-full bg-muted/50 rounded animate-pulse" />
        <div className="h-4 w-5/6 bg-muted/50 rounded animate-pulse" />
        <div className="h-4 w-4/6 bg-muted/50 rounded animate-pulse" />
      </div>
      <div className="mt-4 space-y-1">
        <div className="h-3 w-32 bg-muted/50 rounded animate-pulse" />
        <div className="h-3 w-48 bg-muted/50 rounded animate-pulse" />
      </div>
    </div>
  )
}

function SourceLink({ uri, title }: { uri: string; title: string }) {
  // Extract a display-friendly label from the URI
  const displayTitle = title || uri.split('/').pop() || uri

  return (
    <a
      href={uri}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
    >
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
        />
      </svg>
      {displayTitle}
    </a>
  )
}

function ChunkCard({ content, uri, score }: { content: string; uri: string; score: number }) {
  const [expanded, setExpanded] = useState(false)
  const truncated = content.length > 200
  const displayContent = expanded ? content : content.slice(0, 200)

  return (
    <div className="bg-muted/20 border border-border rounded-md p-3">
      <div className="flex items-center justify-between mb-1.5">
        <a
          href={uri}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline truncate max-w-[70%]"
        >
          {uri.split('/').pop() || uri}
        </a>
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
            score >= 0.7
              ? 'bg-green-500/20 text-green-400'
              : score >= 0.4
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-zinc-500/20 text-zinc-400'
          }`}
        >
          {Math.floor(score * 100)}%
        </span>
      </div>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
        {displayContent}
        {truncated && !expanded && '...'}
      </p>
      {truncated && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-xs text-primary hover:underline"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

export function KnowledgeResultsView({ query }: KnowledgeResultsViewProps) {
  const [result, setResult] = useState<KnowledgeAnswer | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [chunksExpanded, setChunksExpanded] = useState(false)

  useEffect(() => {
    if (!query) {
      setResult(null)
      setError(null)
      setErrorCode(null)
      setLoading(false)
      return
    }

    let cancelled = false

    const fetchAnswer = async () => {
      setLoading(true)
      setError(null)
      setErrorCode(null)

      try {
        const answer = await askKnowledge({ query })
        if (cancelled) return
        setResult(answer)
      } catch (err) {
        if (cancelled) return
        if (err instanceof KnowledgeError) {
          setError(err.message)
          setErrorCode(err.code)
        } else {
          setError(err instanceof Error ? err.message : 'Failed to query knowledge base')
        }
        setResult(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAnswer()
    return () => {
      cancelled = true
    }
  }, [query])

  if (loading) {
    return <LoadingSkeleton />
  }

  if (error) {
    const isUnavailable = errorCode === 'AI_UNAVAILABLE'
    return (
      <div className="p-6 border-b border-border">
        <h2 className="text-base font-medium text-foreground mb-2">Knowledge Base</h2>
        <div
          className={`rounded-lg p-4 ${
            isUnavailable
              ? 'bg-yellow-500/10 border border-yellow-500/30'
              : 'bg-red-500/10 border border-red-500/30'
          }`}
        >
          <p className={isUnavailable ? 'text-yellow-400' : 'text-red-400'}>
            {isUnavailable
              ? 'Knowledge Base is not configured. An AI provider is required for synthesized answers.'
              : error}
          </p>
        </div>
      </div>
    )
  }

  if (!result || !result.answer) {
    return null
  }

  return (
    <div className="p-6 border-b border-border">
      <h2 className="text-base font-medium text-foreground mb-3">Knowledge Base</h2>

      {/* AI-synthesized answer */}
      <div className="prose prose-sm prose-invert max-w-none mb-4 text-foreground [&_a]:text-primary [&_code]:bg-muted/50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_pre]:bg-muted/30 [&_pre]:border [&_pre]:border-border [&_pre]:rounded-lg [&_pre]:p-3">
        <Markdown>{result.answer}</Markdown>
      </div>

      {/* Sources */}
      {result.sources.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Sources</h3>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {result.sources.map((source) => (
              <SourceLink key={source.uri} uri={source.uri} title={source.title} />
            ))}
          </div>
        </div>
      )}

      {/* Collapsible chunks */}
      {result.chunks.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setChunksExpanded(!chunksExpanded)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${chunksExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            Raw Chunks ({result.chunks.length})
          </button>
          {chunksExpanded && (
            <div className="mt-2 space-y-2">
              {result.chunks.map((chunk) => (
                <ChunkCard
                  key={`${chunk.uri}-${chunk.chunkIndex}`}
                  content={chunk.content}
                  uri={chunk.uri}
                  score={chunk.score}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
