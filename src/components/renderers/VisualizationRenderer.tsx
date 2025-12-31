import type { Visualization } from '@/types'
import { MermaidRenderer } from './MermaidRenderer'
import { CardRenderer } from './CardRenderer'
import { CodeRenderer } from './CodeRenderer'
import { TableRenderer } from './TableRenderer'

interface VisualizationRendererProps {
  visualization: Visualization
}

export function VisualizationRenderer({ visualization }: VisualizationRendererProps) {
  switch (visualization.type) {
    case 'mermaid':
      return <MermaidRenderer content={visualization.content} />

    case 'cards':
      return <CardRenderer content={visualization.content} />

    case 'code':
      return <CodeRenderer content={visualization.content} />

    case 'table':
      return <TableRenderer content={visualization.content} />

    default:
      // TypeScript exhaustiveness check - this should never happen
      const _exhaustiveCheck: never = visualization
      return (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
          <p className="text-yellow-400 text-sm">
            Unknown visualization type: {(_exhaustiveCheck as Visualization).type}
          </p>
        </div>
      )
  }
}
