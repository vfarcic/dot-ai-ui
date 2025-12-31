import { useState, useRef, useEffect, useCallback } from 'react'
import type { Visualization } from '@/types'

interface TabContainerProps {
  visualizations: Visualization[]
  renderContent: (visualization: Visualization) => React.ReactNode
}

export function TabContainer({ visualizations, renderContent }: TabContainerProps) {
  const [activeTabId, setActiveTabId] = useState<string>(
    visualizations[0]?.id ?? ''
  )
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

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
            className="absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-[#1a1a1a] via-[#1a1a1a]/90 to-transparent z-10 flex items-center justify-center hover:from-[#252525] transition-colors"
            aria-label="Scroll tabs left"
          >
            <span className="text-primary text-2xl font-bold">‹</span>
          </button>
        )}
        {/* Right scroll button */}
        {canScrollRight && (
          <button
            onClick={scrollRight}
            className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-[#1a1a1a] via-[#1a1a1a]/90 to-transparent z-10 flex items-center justify-center hover:from-[#252525] transition-colors"
            aria-label="Scroll tabs right"
          >
            <span className="text-primary text-2xl font-bold">›</span>
          </button>
        )}
        <div
          ref={scrollRef}
          className="flex overflow-x-auto scrollbar-thin"
        >
          {visualizations.map((viz) => (
            <button
              key={viz.id}
              onClick={() => setActiveTabId(viz.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTabId === viz.id
                  ? 'border-b-2 border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {viz.label}
            </button>
          ))}
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
