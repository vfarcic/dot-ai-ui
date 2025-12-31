import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { TabContainer } from '@/components/TabContainer'
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
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">{data.title}</h1>
        <p className="text-sm text-muted-foreground">
          Session: <code className="bg-muted px-2 py-1 rounded text-xs">{sessionId}</code>
        </p>
      </div>

      <TabContainer
        visualizations={data.visualizations}
        renderContent={(viz) => (
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-2">
              Type: <code>{viz.type}</code>
            </div>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(viz.content, null, 2)}
            </pre>
          </div>
        )}
      />
    </div>
  )
}
