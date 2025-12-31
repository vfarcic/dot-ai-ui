import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { TabContainer } from '@/components/TabContainer'
import { InsightsPanel } from '@/components/InsightsPanel'
import { VisualizationRenderer } from '@/components/renderers'
import { getVisualization, APIError } from '@/api'
import type { VisualizationResponse } from '@/types'

export function Visualization() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [data, setData] = useState<VisualizationResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!sessionId) {
      setError('No session ID provided')
      setIsLoading(false)
      return
    }

    async function fetchData() {
      try {
        setIsLoading(true)
        setError(null)
        const response = await getVisualization(sessionId!)
        setData(response)
      } catch (err) {
        if (err instanceof APIError) {
          setError(err.message)
        } else {
          setError('An unexpected error occurred')
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [sessionId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <p className="text-destructive mb-2">{error}</p>
          <p className="text-sm text-muted-foreground">
            Session: <code className="bg-muted px-2 py-1 rounded text-xs">{sessionId}</code>
          </p>
        </div>
      </div>
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
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold">{data.title}</h1>
      </div>

      <InsightsPanel sessionId={sessionId!} insights={data.insights} />

      <TabContainer
        visualizations={data.visualizations}
        renderContent={(viz) => <VisualizationRenderer visualization={viz} />}
      />
    </div>
  )
}
