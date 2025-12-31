import { useParams } from 'react-router-dom'

export function Visualization() {
  const { sessionId } = useParams<{ sessionId: string }>()

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Visualization</h2>
        <p className="text-muted-foreground">
          Session: <code className="bg-muted px-2 py-1 rounded">{sessionId}</code>
        </p>
        <p className="text-sm text-muted-foreground mt-4">
          Renderers coming in Milestone 2
        </p>
      </div>
    </div>
  )
}
