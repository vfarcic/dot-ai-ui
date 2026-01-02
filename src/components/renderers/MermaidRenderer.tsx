import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import mermaid from 'mermaid'
import { parseMermaid, generateCollapsedCode, type ParsedMermaid } from '../../utils/mermaidParser'

interface MermaidRendererProps {
  content: string
}

// Callback name for Mermaid click handlers
const MERMAID_CALLBACK_NAME = '__mermaidToggle'

// Initialize mermaid with dark theme matching devopstoolkit.ai brand
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose', // Required for click callbacks to work
  themeVariables: {
    primaryColor: '#FACB00',
    primaryTextColor: '#2D2D2D',
    primaryBorderColor: '#FACB00',
    lineColor: '#a3a3a3',
    secondaryColor: '#3d3d3d',
    tertiaryColor: '#2D2D2D',
    background: '#1a1a1a',
    mainBkg: '#3d3d3d',
    secondBkg: '#2D2D2D',
    border1: '#4d4d4d',
    border2: '#FACB00',
    arrowheadColor: '#a3a3a3',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '14px',
    textColor: '#fafafa',
    nodeTextColor: '#fafafa',
  },
})

const MIN_ZOOM = 0.25
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25

export function MermaidRenderer({ content }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRendering, setIsRendering] = useState(true)

  // Zoom and pan state
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Collapsible subgraphs state
  const [collapsedSubgraphs, setCollapsedSubgraphs] = useState<Set<string>>(new Set())

  // Parse Mermaid content to extract subgraph structure
  const parsedMermaid = useMemo<ParsedMermaid>(() => {
    return parseMermaid(content)
  }, [content])

  // Initialize collapsed state when content changes (all subgraphs collapsed by default)
  useEffect(() => {
    if (parsedMermaid.type === 'flowchart' && parsedMermaid.subgraphs.length > 0) {
      const allSubgraphIds = new Set(parsedMermaid.subgraphs.map(sg => sg.id))
      setCollapsedSubgraphs(allSubgraphIds)
    } else {
      setCollapsedSubgraphs(new Set())
    }
  }, [parsedMermaid])

  // Toggle a subgraph's collapsed state
  const toggleSubgraph = useCallback((subgraphId: string) => {
    setCollapsedSubgraphs(prev => {
      const next = new Set(prev)
      if (next.has(subgraphId)) {
        next.delete(subgraphId)
      } else {
        next.add(subgraphId)
      }
      return next
    })
  }, [])

  // Register the callback on window for Mermaid's click handlers
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Mermaid's click callback receives the node ID as the argument
      (window as unknown as Record<string, (id: string) => void>)[MERMAID_CALLBACK_NAME] = toggleSubgraph
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as unknown as Record<string, unknown>)[MERMAID_CALLBACK_NAME]
      }
    }
  }, [toggleSubgraph])

  // Generate display code based on collapsed state
  const displayCode = useMemo(() => {
    if (parsedMermaid.type !== 'flowchart' || collapsedSubgraphs.size === 0) {
      return content
    }
    return generateCollapsedCode(parsedMermaid, collapsedSubgraphs, MERMAID_CALLBACK_NAME)
  }, [content, parsedMermaid, collapsedSubgraphs])

  // Track previous content to know when to reset zoom/pan
  const prevContentRef = useRef<string>(content)

  // Add click handlers to expanded subgraph headers after render
  const attachExpandedSubgraphHandlers = useCallback((container: HTMLElement) => {
    if (parsedMermaid.type !== 'flowchart') return

    // Find all expanded subgraphs (those not in collapsedSubgraphs set)
    const expandedSubgraphs = parsedMermaid.subgraphs.filter(
      sg => !collapsedSubgraphs.has(sg.id)
    )

    // Find all cluster elements in the SVG
    const clusters = container.querySelectorAll('.cluster')

    for (const subgraph of expandedSubgraphs) {
      // Match cluster by label text since Mermaid uses generic IDs (subGraph0, subGraph1, etc.)
      let matchedCluster: Element | null = null

      for (const cluster of clusters) {
        const labelSpan = cluster.querySelector('.cluster-label foreignObject span') ||
                          cluster.querySelector('.cluster-label text')
        const labelText = labelSpan?.textContent?.replace(/^▼\s*/, '') || ''

        // Match by label (handle both exact match and quoted labels)
        if (labelText === subgraph.label ||
            labelText === `'${subgraph.label}'` ||
            labelText.replace(/^'|'$/g, '') === subgraph.label) {
          matchedCluster = cluster
          break
        }
      }

      if (!matchedCluster) continue

      const clusterLabel = matchedCluster.querySelector('.cluster-label')
      if (!clusterLabel) continue

      // Find the span with the label text and the foreignObject container
      const foreignObject = clusterLabel.querySelector('foreignObject')
      const labelSpan = clusterLabel.querySelector('foreignObject span') ||
                        clusterLabel.querySelector('text')

      if (labelSpan) {
        const labelText = labelSpan.textContent || ''
        // Add visual indicator if not already present
        if (!labelText.startsWith('▼')) {
          labelSpan.textContent = `▼ ${labelText}`
          // Increase foreignObject width to accommodate the indicator
          if (foreignObject) {
            const currentWidth = parseFloat(foreignObject.getAttribute('width') || '0')
            foreignObject.setAttribute('width', String(currentWidth + 20))
          }
        }
      }

      // Make the cluster label clickable
      ;(clusterLabel as HTMLElement).style.cursor = 'pointer'
      clusterLabel.classList.add('mermaid-collapsible-header')

      // Create click handler
      const clickHandler = (e: Event) => {
        e.stopPropagation()
        e.preventDefault()
        toggleSubgraph(subgraph.id)
      }

      // Clone and replace to remove old handlers, then add new one
      const newClusterLabel = clusterLabel.cloneNode(true) as HTMLElement
      newClusterLabel.addEventListener('click', clickHandler)
      clusterLabel.parentNode?.replaceChild(newClusterLabel, clusterLabel)
    }
  }, [parsedMermaid, collapsedSubgraphs, toggleSubgraph])

  useEffect(() => {
    async function renderDiagram() {
      if (!svgContainerRef.current || !displayCode) return

      setIsRendering(true)
      setError(null)

      try {
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`
        await mermaid.parse(displayCode)
        const { svg, bindFunctions } = await mermaid.render(id, displayCode)

        if (svgContainerRef.current) {
          svgContainerRef.current.innerHTML = svg
          // Call bindFunctions to enable click callbacks for collapsed placeholders
          bindFunctions?.(svgContainerRef.current)
          // Add click handlers for expanded subgraph headers
          attachExpandedSubgraphHandlers(svgContainerRef.current)
        }

        // Only reset zoom/pan when the original content changes, not on collapse/expand
        if (prevContentRef.current !== content) {
          setZoom(1)
          setPan({ x: 0, y: 0 })
          prevContentRef.current = content
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to render diagram'
        setError(errorMessage)
        console.error('Mermaid render error:', err)
      } finally {
        setIsRendering(false)
      }
    }

    renderDiagram()
  }, [displayCode, content, attachExpandedSubgraphHandlers])

  const handleZoomIn = useCallback(() => {
    setZoom(z => Math.min(z + ZOOM_STEP, MAX_ZOOM))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom(z => Math.max(z - ZOOM_STEP, MIN_ZOOM))
  }, [])

  const handleReset = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
    setZoom(z => Math.min(Math.max(z + delta, MIN_ZOOM), MAX_ZOOM))
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) { // Left click only
      setIsDragging(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }, [pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }
  }, [isDragging, dragStart])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return

    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen?.()
      setIsFullscreen(false)
    }
  }, [isFullscreen])

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
        <p className="text-red-400 text-sm mb-2">Failed to render diagram</p>
        <pre className="text-xs text-muted-foreground overflow-auto">{error}</pre>
        <details className="mt-4">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
            Show raw content
          </summary>
          <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">{content}</pre>
        </details>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col ${isFullscreen ? 'bg-background' : ''}`}
    >
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1">
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="px-2 py-1 text-sm bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
            title="Zoom out"
          >
            −
          </button>
          <span className="px-1.5 sm:px-2 py-1 text-xs text-muted-foreground min-w-[3rem] sm:min-w-[4rem] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="px-2 py-1 text-sm bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
            title="Zoom in"
          >
            +
          </button>
          <button
            onClick={handleReset}
            className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded transition-colors ml-1"
            title="Reset view"
          >
            Reset
          </button>
        </div>
        <div className="flex items-center gap-1">
          <span className="hidden sm:inline text-xs text-muted-foreground mr-2">
            Scroll to zoom • Drag to pan
          </span>
          <button
            onClick={toggleFullscreen}
            className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? 'Exit' : 'Fullscreen'}
          </button>
        </div>
      </div>

      {/* Diagram viewport */}
      <div
        className={`relative overflow-hidden rounded-lg border border-border bg-muted/20 ${
          isFullscreen ? 'flex-1' : 'min-h-[250px] sm:min-h-[400px] max-h-[60vh] sm:max-h-[70vh]'
        }`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        {isRendering && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
            <span className="text-sm text-muted-foreground">Rendering diagram...</span>
          </div>
        )}
        <div
          ref={svgContainerRef}
          className="flex justify-center items-center min-h-full [&_svg]:max-w-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
        />
      </div>
    </div>
  )
}
