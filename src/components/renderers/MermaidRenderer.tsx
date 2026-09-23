import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import mermaid from 'mermaid'
import DOMPurify from 'dompurify'
import { parseMermaid, generateCollapsedCode, type ParsedMermaid } from '../../utils/mermaidParser'
import { sanitizeMermaidSource } from '../../utils/mermaidSanitizer'
import { generateGitHubIssueUrl, GitHubIcon } from '@/utils/errorReporting'

interface MermaidRendererProps {
  content: string
}

// Initialize mermaid with dark theme matching devopstoolkit.ai brand
mermaid.initialize({
  startOnLoad: false,
  layout: 'dagre', // Mermaid 12 defaults to ELK, which re-lays out diagrams and loads a ~450 kB chunk
  look: 'classic', // Mermaid 12 defaults to 'neo', which replaces the brand-yellow borders with gradients
  theme: 'dark',
  // Diagram source is MCP/AI-generated and untrusted. 'strict' disables Mermaid click callbacks
  // and sanitizes link URLs. Collapse/expand does not rely on Mermaid callbacks: the renderer
  // attaches its own DOM listeners after rendering (see attachCollapsedPlaceholderHandlers).
  securityLevel: 'strict',
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

/**
 * DOMPurify config for Mermaid's SVG output, applied on top of Mermaid's own strict-mode pass.
 * SVG profile plus HTML so labels rendered inside <foreignObject> (div/span/p) survive, with the
 * same foreignObject/dominant-baseline allowances Mermaid uses. <style> is kept because Mermaid
 * scopes its theme CSS in an inline <style> element. Scripts, event-handler attributes and
 * javascript: URLs are removed.
 */
const SVG_SANITIZE_CONFIG = {
  USE_PROFILES: { svg: true, svgFilters: true, html: true },
  ADD_TAGS: ['foreignObject'],
  ADD_ATTR: ['dominant-baseline'],
  HTML_INTEGRATION_POINTS: { foreignobject: true },
}

/**
 * Extract the Mermaid node ID from a rendered flowchart node element.
 * Mermaid renders node DOM IDs as `<renderId>-flowchart-<nodeId>-<counter>`.
 */
function getFlowchartNodeId(element: Element): string | null {
  const dataId = element.getAttribute('data-id')
  if (dataId) return dataId
  const match = element.id.match(/(?:^|-)flowchart-(.+)-\d+$/)
  return match ? match[1] : null
}

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

  // Strip every interaction directive (click/href/call/link/callback) from the untrusted source.
  // All clickable behaviour is attached by this component, never taken from the diagram source.
  const safeContent = useMemo(() => {
    const { code, removed } = sanitizeMermaidSource(content)
    if (removed.length > 0) {
      console.warn(`[MermaidRenderer] Removed ${removed.length} interaction directive(s) from diagram source`)
    }
    return code
  }, [content])

  // Parse Mermaid content to extract subgraph structure
  const parsedMermaid = useMemo<ParsedMermaid>(() => {
    return parseMermaid(safeContent)
  }, [safeContent])

  // Collapsible subgraphs state - initialized empty, effect sets based on parsed content
  const [collapsedSubgraphs, setCollapsedSubgraphs] = useState<Set<string>>(new Set())

  // Track content for which collapse state has been initialized
  const initializedContentRef = useRef<string>('')

  // Set/reset collapsed state when content changes (uses memoized parsedMermaid)
  useEffect(() => {
    // Skip if already initialized for this content
    if (initializedContentRef.current === content) return
    initializedContentRef.current = content

    if (parsedMermaid.type === 'flowchart' && parsedMermaid.subgraphs.length > 0) {
      setCollapsedSubgraphs(new Set(parsedMermaid.subgraphs.map(sg => sg.id)))
    } else {
      setCollapsedSubgraphs(new Set())
    }
  }, [content, parsedMermaid])

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

  // Generate display code based on collapsed state
  const displayCode = useMemo(() => {
    if (parsedMermaid.type !== 'flowchart' || collapsedSubgraphs.size === 0) {
      return safeContent
    }
    return generateCollapsedCode(parsedMermaid, collapsedSubgraphs)
  }, [safeContent, parsedMermaid, collapsedSubgraphs])

  // Track previous content to know when to reset zoom/pan and pulse animation
  // Initialize to empty string so first render is detected as "new content"
  const prevContentRef = useRef<string>('')
  const hasAppliedInitialPulse = useRef<boolean>(false)

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

      // Normalize label for comparison (strip quotes, trim whitespace)
      const normalizeLabel = (text: string) =>
        text.replace(/^▼\s*/, '').replace(/^['"]|['"]$/g, '').trim()

      const normalizedSubgraphLabel = normalizeLabel(subgraph.label)

      for (const cluster of clusters) {
        // Try multiple selectors - Mermaid structure varies by diagram complexity
        const labelSpan = cluster.querySelector('.cluster-label foreignObject span') ||
                          cluster.querySelector('.cluster-label text') ||
                          cluster.querySelector('.cluster-label p') ||
                          cluster.querySelector('.nodeLabel') ||
                          cluster.querySelector('text')

        if (!labelSpan) continue

        const labelText = labelSpan.textContent || ''
        const normalizedLabelText = normalizeLabel(labelText)

        // Match by normalized label (handles quotes, indicators, whitespace)
        if (normalizedLabelText === normalizedSubgraphLabel) {
          matchedCluster = cluster
          break
        }
      }

      if (!matchedCluster) continue

      // Find cluster label - try multiple selectors for different Mermaid structures
      let clusterLabel = matchedCluster.querySelector('.cluster-label')

      // If no .cluster-label, use the cluster itself as the clickable area
      if (!clusterLabel) {
        clusterLabel = matchedCluster
      }

      // Find the span with the label text and the foreignObject container
      const foreignObject = clusterLabel.querySelector('foreignObject')
      const labelSpan = clusterLabel.querySelector('foreignObject span') ||
                        clusterLabel.querySelector('.cluster-label text') ||
                        clusterLabel.querySelector('text') ||
                        clusterLabel.querySelector('p')

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

  // Make collapsed-subgraph placeholder nodes clickable (expands the subgraph).
  // Replaces Mermaid's `click <id> <callback>` mechanism, which needs securityLevel 'loose'.
  const attachCollapsedPlaceholderHandlers = useCallback((container: HTMLElement) => {
    if (parsedMermaid.type !== 'flowchart' || collapsedSubgraphs.size === 0) return

    for (const node of container.querySelectorAll('.node')) {
      const nodeId = getFlowchartNodeId(node)
      if (!nodeId || !collapsedSubgraphs.has(nodeId)) continue

      node.classList.add('clickable')
      ;(node as HTMLElement).style.cursor = 'pointer'
      node.addEventListener('click', (e: Event) => {
        e.stopPropagation()
        e.preventDefault()
        toggleSubgraph(nodeId)
      })
    }
  }, [parsedMermaid, collapsedSubgraphs, toggleSubgraph])

  // Apply pulse animation to collapsed placeholder nodes
  const applyPulseToCollapsedNodes = useCallback((container: HTMLElement) => {
    console.log('[Pulse] Checking - type:', parsedMermaid.type, 'collapsedCount:', collapsedSubgraphs.size)
    if (parsedMermaid.type !== 'flowchart' || collapsedSubgraphs.size === 0) return

    // Find all clickable nodes (collapsed placeholders have click handlers)
    const clickableNodes = container.querySelectorAll('.node.clickable')
    console.log('[Pulse] Found clickable nodes:', clickableNodes.length)

    for (const node of clickableNodes) {
      // Add pulse class - animation will play twice then stop
      node.classList.add('mermaid-collapsed-pulse')
    }
  }, [parsedMermaid, collapsedSubgraphs])

  useEffect(() => {
    async function renderDiagram() {
      if (!svgContainerRef.current || !displayCode) return

      setIsRendering(true)
      setError(null)

      try {
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`
        await mermaid.parse(displayCode)
        // bindFunctions is intentionally not used: no Mermaid-managed callbacks are trusted.
        const { svg } = await mermaid.render(id, displayCode)

        if (svgContainerRef.current) {
          svgContainerRef.current.innerHTML = DOMPurify.sanitize(svg, SVG_SANITIZE_CONFIG)
          // Add click handlers for collapsed placeholders and expanded subgraph headers
          attachCollapsedPlaceholderHandlers(svgContainerRef.current)
          attachExpandedSubgraphHandlers(svgContainerRef.current)

          // Only reset zoom/pan and apply pulse when the original content changes, not on collapse/expand
          if (prevContentRef.current !== content) {
            setZoom(1)
            setPan({ x: 0, y: 0 })
            prevContentRef.current = content
            hasAppliedInitialPulse.current = false
          }

          // Only apply pulse animation on initial render for this content
          if (!hasAppliedInitialPulse.current) {
            applyPulseToCollapsedNodes(svgContainerRef.current)
            hasAppliedInitialPulse.current = true
          }
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
  }, [displayCode, content, attachCollapsedPlaceholderHandlers, attachExpandedSubgraphHandlers, applyPulseToCollapsedNodes])

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
    const issueUrl = generateGitHubIssueUrl({
      errorName: 'RenderError',
      errorMessage: error,
      component: 'MermaidRenderer',
      rawContent: content,
      contentLabel: 'Mermaid diagram',
    })

    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-red-400 text-sm mb-2">Failed to render diagram</p>
            <pre className="text-xs text-muted-foreground overflow-auto">{error}</pre>
          </div>
          <a
            href={issueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-[#FACB00] hover:bg-[#FACB00]/80 rounded-md text-[#2D2D2D] transition-colors shrink-0"
          >
            <GitHubIcon className="w-4 h-4" />
            Report Issue
          </a>
        </div>
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
