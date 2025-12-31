import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { TabContainer } from '@/components/TabContainer'
import { InsightsPanel } from '@/components/InsightsPanel'
import { ErrorDisplay } from '@/components/ErrorDisplay'
import { VisualizationRenderer } from '@/components/renderers'
import { getVisualization, APIError } from '@/api'
import type { VisualizationResponse } from '@/types'

export function Visualization() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [data, setData] = useState<VisualizationResponse | null>(null)
  const [error, setError] = useState<APIError | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!sessionId) return

    try {
      setIsLoading(true)
      setError(null)
      const response = await getVisualization(sessionId)
      setData(response)
    } catch (err) {
      if (err instanceof APIError) {
        setError(err)
      } else {
        setError(new APIError('An unexpected error occurred', 0, 'Unknown'))
      }
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) {
      setError(new APIError('No session ID provided', 400, 'Bad Request'))
      setIsLoading(false)
      return
    }

    fetchData()
  }, [sessionId, fetchData])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
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
      </div>

      <InsightsPanel sessionId={sessionId!} insights={data.insights} />

      <TabContainer
        visualizations={data.visualizations}
        renderContent={(viz) => <VisualizationRenderer visualization={viz} />}
      />
    </div>
  )
}
