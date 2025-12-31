import { useState } from 'react'
import type { Visualization } from '@/types'

interface TabContainerProps {
  visualizations: Visualization[]
  renderContent: (visualization: Visualization) => React.ReactNode
}

export function TabContainer({ visualizations, renderContent }: TabContainerProps) {
  const [activeTabId, setActiveTabId] = useState<string>(
    visualizations[0]?.id ?? ''
  )

  if (visualizations.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No visualizations available
      </div>
    )
  }

  const activeVisualization = visualizations.find((v) => v.id === activeTabId)

  return (
    <div className="flex flex-col">
      {/* Tab buttons */}
      <div className="flex border-b border-border">
        {visualizations.map((viz) => (
          <button
            key={viz.id}
            onClick={() => setActiveTabId(viz.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTabId === viz.id
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {viz.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4">
        {activeVisualization ? (
          renderContent(activeVisualization)
        ) : (
          <div className="text-center text-muted-foreground">
            Select a tab to view content
          </div>
        )}
      </div>
    </div>
  )
}
