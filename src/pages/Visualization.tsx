import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { TabContainer } from '@/components/TabContainer'
import { InsightsPanel } from '@/components/InsightsPanel'
import { ErrorDisplay } from '@/components/ErrorDisplay'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { VisualizationRenderer } from '@/components/renderers'
import { getVisualization, APIError } from '@/api'
import type { VisualizationResponse } from '@/types'

export function Visualization() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [data, setData] = useState<VisualizationResponse | null>(null)
  const [error, setError] = useState<APIError | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isReloading, setIsReloading] = useState(false)

  const fetchData = useCallback(async (reload = false) => {
    if (!sessionId) return

    try {
      if (reload) {
        setIsReloading(true)
      } else {
        setIsLoading(true)
      }
      setError(null)
      const response = await getVisualization(sessionId, { reload })
      setData(response)
    } catch (err) {
      if (err instanceof APIError) {
        setError(err)
      } else {
        setError(new APIError('An unexpected error occurred', 0, 'Unknown'))
      }
    } finally {
      setIsLoading(false)
      setIsReloading(false)
    }
  }, [sessionId])

  const handleReload = useCallback(() => {
    fetchData(true)
  }, [fetchData])

  useEffect(() => {
    if (!sessionId) {
      setError(new APIError('No session ID provided', 400, 'Bad Request'))
      setIsLoading(false)
      return
    }

    fetchData()
  }, [sessionId, fetchData])

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (error) {
    return (
      <ErrorDisplay
        type={error.errorType}
        message={error.message}
        sessionId={sessionId}
        onRetry={error.isRetryable ? fetchData : undefined}
      />
    )
  }

  if (!data || !data.visualizations || data.visualizations.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="text-muted-foreground mb-4">No visualizations available</div>
          {data && (
            <pre className="text-xs text-left bg-muted p-4 rounded overflow-auto max-w-xl">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <h1 className="text-base sm:text-lg font-semibold leading-tight">{data.title}</h1>
        <button
          onClick={handleReload}
          disabled={isReloading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-black bg-yellow-400 hover:bg-yellow-500 rounded-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="Reload data (invalidate cache)"
        >
          <svg
            className={`w-4 h-4 ${isReloading ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {isReloading ? 'Reloading...' : 'Reload'}
        </button>
      </div>

      <InsightsPanel sessionId={sessionId!} insights={data.insights} />

      <TabContainer
        visualizations={data.visualizations}
        renderContent={(viz) => <VisualizationRenderer visualization={viz} />}
      />
    </div>
  )
}
