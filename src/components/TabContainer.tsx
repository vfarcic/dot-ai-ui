import { useState, useRef, useEffect, useCallback } from 'react'
import type { Visualization, StatusIndicator } from '@/types'

interface TabContainerProps {
  visualizations: Visualization[]
  renderContent: (visualization: Visualization) => React.ReactNode
}

// Derive aggregate status from visualization content
function getVisualizationStatus(viz: Visualization): StatusIndicator | undefined {
  if (viz.type === 'cards') {
    const statuses = viz.content.map((card) => card.status).filter(Boolean) as StatusIndicator[]
    if (statuses.includes('error')) return 'error'
    if (statuses.includes('warning')) return 'warning'
    if (statuses.includes('ok')) return 'ok'
  } else if (viz.type === 'table' && viz.content.rowStatuses) {
    const statuses = viz.content.rowStatuses.filter(Boolean) as StatusIndicator[]
    if (statuses.includes('error')) return 'error'
    if (statuses.includes('warning')) return 'warning'
    if (statuses.includes('ok')) return 'ok'
  }
  return undefined
}

function StatusDot({ status }: { status: StatusIndicator }) {
  const colorClass = {
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    ok: 'bg-green-500',
  }[status]

  return <span className={`w-2 h-2 rounded-full ${colorClass}`} />
}

export function TabContainer({ visualizations, renderContent }: TabContainerProps) {
  const [activeTabId, setActiveTabId] = useState<string>('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  // Auto-select first tab when visualizations load or change
  useEffect(() => {
    if (visualizations.length > 0) {
      const currentTabExists = visualizations.some((v) => v.id === activeTabId)
      if (!currentTabExists) {
        setActiveTabId(visualizations[0].id)
      }
    }
  }, [visualizations, activeTabId])

  const updateScrollIndicators = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1)
  }, [])

  const scrollLeft = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: -200, behavior: 'smooth' })
  }, [])

  const scrollRight = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: 200, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateScrollIndicators()
    el.addEventListener('scroll', updateScrollIndicators)
    window.addEventListener('resize', updateScrollIndicators)
    return () => {
      el.removeEventListener('scroll', updateScrollIndicators)
      window.removeEventListener('resize', updateScrollIndicators)
    }
  }, [updateScrollIndicators])

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
      {/* Tab buttons - horizontally scrollable with indicators */}
      <div className="relative border-b border-border">
        {/* Left scroll button */}
        {canScrollLeft && (
          <button
            onClick={scrollLeft}
            className="absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-[#1a1a1a] via-[#1a1a1a]/90 to-transparent z-10 flex items-center justify-center hover:from-[#252525] transition-colors cursor-pointer"
            aria-label="Scroll tabs left"
          >
            <span className="text-primary text-2xl font-bold">‹</span>
          </button>
        )}
        {/* Right scroll button */}
        {canScrollRight && (
          <button
            onClick={scrollRight}
            className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-[#1a1a1a] via-[#1a1a1a]/90 to-transparent z-10 flex items-center justify-center hover:from-[#252525] transition-colors cursor-pointer"
            aria-label="Scroll tabs right"
          >
            <span className="text-primary text-2xl font-bold">›</span>
          </button>
        )}
        <div
          ref={scrollRef}
          className="flex overflow-x-auto scrollbar-thin"
        >
          {visualizations.map((viz) => {
            const status = getVisualizationStatus(viz)
            return (
              <button
                key={viz.id}
                onClick={() => setActiveTabId(viz.id)}
                className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 cursor-pointer flex items-center gap-2 ${
                  activeTabId === viz.id
                    ? 'border-b-2 border-primary text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {viz.label}
                {status && status !== 'ok' && <StatusDot status={status} />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="pt-4">
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
