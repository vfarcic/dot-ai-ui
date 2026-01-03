/**
 * Mermaid Flowchart Parser
 * Extracts subgraph structure from Mermaid flowchart source code
 * for implementing collapsible subgraphs feature.
 */

export interface ParsedSubgraph {
  id: string              // Subgraph identifier (e.g., "services")
  label: string           // Display label (e.g., "Services Layer")
  content: string         // Raw content inside subgraph (excluding nested subgraphs)
  nodeIds: string[]       // Node IDs contained within (direct children only)
  startIndex: number      // Start position in source
  endIndex: number        // End position in source (after 'end')
  depth: number           // Nesting depth (0 = top level)
  parentId: string | null // Parent subgraph ID if nested
}

export interface ParsedMermaid {
  type: 'flowchart' | 'other'  // Only flowcharts support collapse
  direction: string            // TD, TB, BT, LR, RL
  subgraphs: ParsedSubgraph[]  // All subgraphs found (ordered by appearance)
  originalCode: string         // Original source code
}

/**
 * Check if the Mermaid code is a flowchart type
 */
export function isFlowchart(code: string): boolean {
  const trimmed = code.trim()
  return /^(graph|flowchart)\s+(TD|TB|BT|LR|RL|DT)/im.test(trimmed)
}

/**
 * Extract the flowchart direction (TD, LR, etc.)
 */
export function getFlowchartDirection(code: string): string {
  const match = code.match(/^(graph|flowchart)\s+(TD|TB|BT|LR|RL|DT)/im)
  return match ? match[2].toUpperCase() : 'TD'
}

/**
 * Keywords to exclude from node ID extraction
 */
const MERMAID_KEYWORDS = new Set([
  'subgraph', 'end', 'graph', 'flowchart', 'direction',
  'style', 'class', 'click', 'linkStyle', 'classDef',
  'td', 'tb', 'bt', 'lr', 'rl', 'dt'
])

/**
 * Check if a string is a Mermaid keyword
 */
function isMermaidKeyword(str: string): boolean {
  return MERMAID_KEYWORDS.has(str.toLowerCase())
}

/**
 * Extract node IDs from a block of Mermaid content.
 * Matches various node shapes including:
 * - Rectangle: A[text]
 * - Rounded: B(text)
 * - Stadium: C([text])
 * - Subroutine: D[[text]]
 * - Cylinder/Database: E[(text)]
 * - Circle: F((text))
 * - Asymmetric: G>text]
 * - Rhombus: H{text}
 * - Hexagon: I{{text}}
 * - Parallelogram: J[/text/], K[\text\]
 * - Trapezoid: L[/text\], M[\text/]
 * - Double circle: N(((text)))
 */
export function extractNodeIds(content: string): string[] {
  const nodeIds: string[] = []

  // Remove comments
  const withoutComments = content.replace(/%%.*$/gm, '')

  // Comprehensive node shape patterns
  // Order matters - more specific patterns first
  const nodePatterns = [
    // Triple parentheses: (((text))) - double circle
    /(\w+)\s*\(\(\([^)]*\)\)\)/g,
    // Double brackets with special chars: [/text/], [\text\], [/text\], [\text/]
    /(\w+)\s*\[[\\/][^\]]*[\\/]\]/g,
    // Double square brackets: [[text]] - subroutine
    /(\w+)\s*\[\[[^\]]*\]\]/g,
    // Stadium shape: ([text])
    /(\w+)\s*\(\[[^\]]*\]\)/g,
    // Cylinder/database: [(text)]
    /(\w+)\s*\[\([^)]*\)\]/g,
    // Double curly: {{text}} - hexagon
    /(\w+)\s*\{\{[^}]*\}\}/g,
    // Double parentheses: ((text)) - circle
    /(\w+)\s*\(\([^)]*\)\)/g,
    // Single brackets with nested (handles complex content)
    /(\w+)\s*\[(?:[^[\]]|\[[^\]]*\])*\]/g,
    // Single parentheses
    /(\w+)\s*\((?:[^()]|\([^)]*\))*\)/g,
    // Single curly: {text} - rhombus
    /(\w+)\s*\{(?:[^{}]|\{[^}]*\})*\}/g,
    // Asymmetric: >text]
    /(\w+)\s*>\s*[^\]]+\]/g,
  ]

  for (const pattern of nodePatterns) {
    let match
    while ((match = pattern.exec(withoutComments)) !== null) {
      const nodeId = match[1]
      if (!isMermaidKeyword(nodeId) && !nodeIds.includes(nodeId)) {
        nodeIds.push(nodeId)
      }
    }
  }

  // Extract nodes from edges (handles nodes without explicit shape definition)
  const edges = extractEdges(withoutComments)
  for (const edge of edges) {
    if (!isMermaidKeyword(edge.source) && !nodeIds.includes(edge.source)) {
      nodeIds.push(edge.source)
    }
    if (!isMermaidKeyword(edge.target) && !nodeIds.includes(edge.target)) {
      nodeIds.push(edge.target)
    }
  }

  return nodeIds
}

/**
 * Find all subgraph blocks in the Mermaid code.
 * Handles nested subgraphs by tracking depth.
 */
export function parseSubgraphs(code: string): ParsedSubgraph[] {
  const subgraphs: ParsedSubgraph[] = []
  const lines = code.split('\n')

  // Stack to track nested subgraphs: {id, label, startLine, startIndex, depth, parentId}
  const stack: Array<{
    id: string
    label: string
    startLine: number
    startIndex: number
    depth: number
    parentId: string | null
    contentStartIndex: number
  }> = []

  let currentIndex = 0

  // Track generated IDs to detect collisions
  const generatedIds = new Set<string>()

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum]
    const trimmedLine = line.trim()

    // Skip comments
    if (trimmedLine.startsWith('%%')) {
      currentIndex += line.length + 1 // +1 for newline
      continue
    }

    // Check for subgraph start
    // Patterns:
    // 1. "subgraph id[label]" or "subgraph id [label]" - id with bracket label
    // 2. "subgraph id" - id only
    // 3. "subgraph "label"" - quoted label (label becomes sanitized id)
    const subgraphMatchId = trimmedLine.match(/^subgraph\s+(\w+)(?:\s*\[([^\]]*)\])?/)
    const subgraphMatchQuoted = trimmedLine.match(/^subgraph\s+"([^"]+)"/)

    const subgraphMatch = subgraphMatchId || subgraphMatchQuoted

    if (subgraphMatch) {
      let id: string
      let label: string

      if (subgraphMatchQuoted && !subgraphMatchId) {
        // Quoted label pattern: subgraph "Label Text"
        label = subgraphMatchQuoted[1]
        // Generate ID from label by sanitizing (remove spaces, special chars)
        const baseId = label.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
        // Ensure uniqueness by appending counter if collision
        id = baseId
        let counter = 1
        while (generatedIds.has(id)) {
          id = `${baseId}_${counter++}`
        }
        generatedIds.add(id)
      } else if (subgraphMatchId) {
        // ID-based pattern: subgraph id[label] or subgraph id
        id = subgraphMatchId[1]
        label = subgraphMatchId[2] || id
      } else {
        currentIndex += line.length + 1
        continue
      }
      const depth = stack.length
      const parentId = stack.length > 0 ? stack[stack.length - 1].id : null

      stack.push({
        id,
        label,
        startLine: lineNum,
        startIndex: currentIndex,
        depth,
        parentId,
        contentStartIndex: currentIndex + line.length + 1,
      })
    }

    // Check for subgraph end
    if (trimmedLine === 'end' && stack.length > 0) {
      const subgraph = stack.pop()!
      const endIndex = currentIndex + line.length

      // Extract content between subgraph declaration and end
      const contentEndIndex = currentIndex
      const content = code.slice(subgraph.contentStartIndex, contentEndIndex).trim()

      // Extract node IDs from direct content (not nested subgraphs)
      const contentWithoutNestedSubgraphs = removeNestedSubgraphs(content)
      const nodeIds = extractNodeIds(contentWithoutNestedSubgraphs)

      subgraphs.push({
        id: subgraph.id,
        label: subgraph.label,
        content,
        nodeIds,
        startIndex: subgraph.startIndex,
        endIndex,
        depth: subgraph.depth,
        parentId: subgraph.parentId,
      })
    }

    currentIndex += line.length + 1 // +1 for newline
  }

  // Sort by startIndex to maintain order of appearance
  return subgraphs.sort((a, b) => a.startIndex - b.startIndex)
}

/**
 * Remove nested subgraph blocks from content to extract only direct children nodes
 */
function removeNestedSubgraphs(content: string): string {
  let result = ''
  let depth = 0
  const lines = content.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.match(/^subgraph\s+/)) {
      depth++
    } else if (trimmed === 'end' && depth > 0) {
      depth--
    } else if (depth === 0) {
      result += line + '\n'
    }
  }

  return result
}

/**
 * Main parser function - parses Mermaid code and extracts structure
 */
export function parseMermaid(code: string): ParsedMermaid {
  if (!isFlowchart(code)) {
    return {
      type: 'other',
      direction: '',
      subgraphs: [],
      originalCode: code,
    }
  }

  return {
    type: 'flowchart',
    direction: getFlowchartDirection(code),
    subgraphs: parseSubgraphs(code),
    originalCode: code,
  }
}

/**
 * Get top-level subgraphs only (depth === 0)
 */
export function getTopLevelSubgraphs(parsed: ParsedMermaid): ParsedSubgraph[] {
  return parsed.subgraphs.filter(sg => sg.depth === 0)
}

/**
 * Get child subgraphs of a parent
 */
export function getChildSubgraphs(parsed: ParsedMermaid, parentId: string): ParsedSubgraph[] {
  return parsed.subgraphs.filter(sg => sg.parentId === parentId)
}

/**
 * Count total nodes in a subgraph (including nested subgraphs)
 */
export function countSubgraphNodes(parsed: ParsedMermaid, subgraphId: string): number {
  const subgraph = parsed.subgraphs.find(sg => sg.id === subgraphId)
  if (!subgraph) return 0

  let count = subgraph.nodeIds.length

  // Add nodes from nested subgraphs
  const children = getChildSubgraphs(parsed, subgraphId)
  for (const child of children) {
    count += countSubgraphNodes(parsed, child.id)
  }

  return count
}

// ============================================================================
// M2: Collapsed Code Generator
// ============================================================================

export interface ParsedEdge {
  source: string       // Source node/subgraph ID
  target: string       // Target node/subgraph ID
  label?: string       // Edge label if any
  style: string        // Arrow style: -->, ---, -.->, etc.
  originalLine: string // Original line for reconstruction
}

/**
 * Arrow patterns for Mermaid edges
 * Ordered by specificity (longer patterns first to avoid partial matches)
 */
const ARROW_PATTERNS = [
  // Bidirectional
  '<-->',
  'o--o',
  'x--x',
  // Thick arrows
  '==>',
  '===',
  // Dotted arrows with text: -. text .->
  '-\\.\\s*[^.]+\\s*\\.->',
  '-\\.\\s*[^.]+\\s*\\.-',
  // Dotted arrows
  '-.->',
  '-.-',
  // Standard arrows with text: -- text -->
  '--\\s*[^-]+\\s*-->',
  '--\\s*[^-]+\\s*---',
  // Circle/cross ends
  '--o',
  '--x',
  'o--',
  'x--',
  // Standard Mermaid arrows (not HTML comment syntax)
  '-->', // lgtm[js/incomplete-sanitization] - Mermaid arrow, not HTML
  '---',
]

// Build regex pattern for arrows (escape special chars for non-text patterns)
const ARROW_REGEX_PART = ARROW_PATTERNS.map(p => {
  // Patterns with \s already have regex, use as-is
  if (p.includes('\\s')) return `(${p})`
  // Escape special regex chars
  return `(${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`
}).join('|')

// Pre-compiled regex for simple edge matching (avoids repeated regex construction)
const SIMPLE_EDGE_REGEX = new RegExp(
  `^\\s*(\\w+)\\s*(?:${ARROW_REGEX_PART})\\s*(?:\\|([^|]*)\\|\\s*)?(\\w+)`
)

/**
 * Extract all edges from Mermaid flowchart code
 * Handles: simple edges, chained edges (A --> B --> C), parallel edges (A & B --> C),
 * and text on arrows (A -- text --> B)
 */
export function extractEdges(code: string): ParsedEdge[] {
  const edges: ParsedEdge[] = []
  const lines = code.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip comments, subgraph declarations, and keywords
    if (trimmed.startsWith('%%') ||
        trimmed.startsWith('subgraph') ||
        trimmed === 'end' ||
        trimmed.match(/^(graph|flowchart)\s+/i) ||
        trimmed.match(/^(style|class|click|linkStyle)\s+/i) ||
        trimmed.match(/^direction\s+/i)) {
      continue
    }

    // Parse edges from this line
    const lineEdges = parseEdgeLine(trimmed, line)
    edges.push(...lineEdges)
  }

  return edges
}

/**
 * Parse a single line for edges, handling chains and parallel syntax
 */
function parseEdgeLine(trimmed: string, originalLine: string): ParsedEdge[] {
  const edges: ParsedEdge[] = []

  // Handle parallel sources: A & B --> C
  // Split on & but only outside of brackets/quotes
  const parallelMatch = trimmed.match(/^([\w\s&]+?)\s*(-->|---|-\.->|-\.-|==>|===|--[ox]|o--o|x--x|<-->|-\.[^.]+\.->|--[^-]+-->)\s*(?:\|([^|]*)\|\s*)?([\w[\](){}'"<>\s&]+)$/)

  if (parallelMatch) {
    const sourcePart = parallelMatch[1]
    const style = normalizeArrowStyle(parallelMatch[2])
    const label = parallelMatch[3] || extractArrowText(parallelMatch[2])
    const targetPart = parallelMatch[4]

    // Split sources by &
    const sources = sourcePart.split('&').map(s => extractNodeId(s.trim())).filter(Boolean)
    // Split targets by & (for A --> B & C syntax)
    const targets = targetPart.split('&').map(t => extractNodeId(t.trim())).filter(Boolean)

    // Create edges for all combinations
    for (const source of sources) {
      for (const target of targets) {
        if (source && target) {
          edges.push({ source, target, label, style, originalLine })
        }
      }
    }

    return edges
  }

  // Handle chained edges: A --> B --> C
  // Find all nodes and arrows in sequence
  const chainedEdges = parseChainedEdges(trimmed, originalLine)
  if (chainedEdges.length > 0) {
    return chainedEdges
  }

  // Simple single edge fallback (uses pre-compiled regex)
  const simpleMatch = trimmed.match(SIMPLE_EDGE_REGEX)
  if (simpleMatch) {
    const source = simpleMatch[1]
    // Find which arrow group matched
    let style = ''
    let labelFromArrow = ''
    for (let i = 2; i < simpleMatch.length - 2; i++) {
      if (simpleMatch[i]) {
        const arrowText = simpleMatch[i]
        labelFromArrow = extractArrowText(arrowText)
        style = normalizeArrowStyle(arrowText)
        break
      }
    }
    const pipeLabel = simpleMatch[simpleMatch.length - 2]
    const target = simpleMatch[simpleMatch.length - 1]

    edges.push({
      source,
      target,
      label: pipeLabel || labelFromArrow || undefined,
      style: style || '-->',
      originalLine,
    })
  }

  return edges
}

/**
 * Parse chained edges like A --> B --> C --> D
 */
function parseChainedEdges(line: string, originalLine: string): ParsedEdge[] {
  const edges: ParsedEdge[] = []

  // Regex to split by Mermaid arrows while capturing them
  // Note: --> is Mermaid arrow syntax, not HTML comment closer
  // lgtm[js/incomplete-sanitization] - Parsing Mermaid diagram DSL, not filtering HTML
  const arrowRegex = /(-->|---|-\.->|-\.-|==>|===|--[ox]|o--o|x--x|<-->|-\.[^.]+\.->|--[^-]+-->)/g

  // Split the line by arrows
  const parts = line.split(arrowRegex)

  // Need at least 3 parts for a chain: [node, arrow, node]
  if (parts.length < 3) return []

  // Process pairs: node, arrow, node, arrow, node, ...
  for (let i = 0; i < parts.length - 2; i += 2) {
    const sourcePart = parts[i].trim()
    const arrow = parts[i + 1]
    const targetPart = parts[i + 2].trim()

    // Extract node IDs (handle node definitions like A[text])
    const source = extractNodeId(sourcePart)
    const target = extractNodeId(targetPart)

    // Check for pipe label after arrow: --> |label| target
    let label = extractArrowText(arrow)
    const pipeMatch = targetPart.match(/^\|([^|]*)\|\s*(\w+)/)
    if (pipeMatch) {
      label = pipeMatch[1]
    }

    if (source && target) {
      edges.push({
        source,
        target,
        label: label || undefined,
        style: normalizeArrowStyle(arrow),
        originalLine,
      })
    }
  }

  return edges
}

/**
 * Extract node ID from a node definition (handles A, A[text], A(text), etc.)
 */
function extractNodeId(nodePart: string): string {
  // Remove leading pipe label if present: |label| nodeId
  const withoutPipeLabel = nodePart.replace(/^\|[^|]*\|\s*/, '')

  // Match node ID at start, before any shape brackets
  const match = withoutPipeLabel.match(/^(\w+)/)
  return match ? match[1] : ''
}

/**
 * Extract text from arrow with embedded text (-- text --> or -. text .->)
 */
function extractArrowText(arrow: string): string {
  // Match -- text --> pattern
  const dashMatch = arrow.match(/^--\s*(.+?)\s*-->$/)
  if (dashMatch) return dashMatch[1]

  // Match -. text .-> pattern
  const dotMatch = arrow.match(/^-\.\s*(.+?)\s*\.->$/)
  if (dotMatch) return dotMatch[1]

  return ''
}

/**
 * Normalize arrow style to standard form (remove embedded text)
 */
function normalizeArrowStyle(arrow: string): string {
  // Convert text arrows to standard form
  if (arrow.match(/^--\s*.+\s*-->$/)) return '-->'
  if (arrow.match(/^--\s*.+\s*---$/)) return '---'
  if (arrow.match(/^-\.\s*.+\s*\.->$/)) return '-.->'
  if (arrow.match(/^-\.\s*.+\s*\.-$/)) return '-.-'
  return arrow
}

/**
 * Find the outermost collapsed ancestor for a subgraph
 */
function findOutermostCollapsedAncestor(
  parsed: ParsedMermaid,
  subgraphId: string,
  collapsedIds: Set<string>
): string | null {
  const subgraph = parsed.subgraphs.find(sg => sg.id === subgraphId)
  if (!subgraph) return null

  // Walk up the parent chain to find the outermost collapsed ancestor
  let current: ParsedSubgraph | undefined = subgraph
  let outermostCollapsed: string | null = null

  while (current) {
    if (collapsedIds.has(current.id)) {
      outermostCollapsed = current.id
    }
    if (current.parentId) {
      current = parsed.subgraphs.find(sg => sg.id === current!.parentId)
    } else {
      break
    }
  }

  return outermostCollapsed
}

/**
 * Get all node IDs that are hidden (inside collapsed subgraphs)
 */
export function getHiddenNodes(
  parsed: ParsedMermaid,
  collapsedIds: Set<string>
): Map<string, string> {
  // Map from hidden node ID to the collapsed subgraph ID it belongs to
  const hiddenNodes = new Map<string, string>()

  // Helper to recursively collect all nodes in a subgraph and its children
  function collectNodes(subgraphId: string, rootCollapsedId: string) {
    const subgraph = parsed.subgraphs.find(sg => sg.id === subgraphId)
    if (!subgraph) return

    // Add direct nodes
    for (const nodeId of subgraph.nodeIds) {
      hiddenNodes.set(nodeId, rootCollapsedId)
    }

    // Add nested subgraph IDs as hidden nodes too (they become edges targets)
    const children = getChildSubgraphs(parsed, subgraphId)
    for (const child of children) {
      hiddenNodes.set(child.id, rootCollapsedId)
      collectNodes(child.id, rootCollapsedId)
    }
  }

  // Process each collapsed subgraph, but only if it doesn't have a collapsed parent
  // (nested collapsed subgraphs are handled by their parent's collapse)
  for (const collapsedId of collapsedIds) {
    const outermostAncestor = findOutermostCollapsedAncestor(parsed, collapsedId, collapsedIds)
    // Only process top-level collapsed subgraphs (those that are their own outermost ancestor)
    if (outermostAncestor === collapsedId) {
      collectNodes(collapsedId, collapsedId)
    }
  }

  return hiddenNodes
}

/**
 * Generate modified Mermaid code with collapsed subgraphs replaced by placeholders
 * @param callbackName - Optional callback function name for click handlers (default: __mermaidToggle)
 */
export function generateCollapsedCode(
  parsed: ParsedMermaid,
  collapsedIds: Set<string>,
  callbackName: string = '__mermaidToggle'
): string {
  // If no subgraphs to collapse, return original
  if (collapsedIds.size === 0 || parsed.type !== 'flowchart') {
    return parsed.originalCode
  }

  const lines: string[] = []
  const clickDirectives: string[] = [] // Collect click directives to add at the end
  const hiddenNodes = getHiddenNodes(parsed, collapsedIds)
  const originalLines = parsed.originalCode.split('\n')

  // Add header
  const headerMatch = parsed.originalCode.match(/^(graph|flowchart)\s+(TD|TB|BT|LR|RL|DT)/im)
  if (headerMatch) {
    lines.push(headerMatch[0])
  }

  // Process original code line by line, replacing as needed
  let inCollapsedSubgraph = false
  let collapsedDepth = 0

  for (const line of originalLines) {
    const trimmed = line.trim()

    // Skip header (already added)
    if (trimmed.match(/^(graph|flowchart)\s+(TD|TB|BT|LR|RL|DT)/i)) {
      continue
    }

    // Skip comments - pass through
    if (trimmed.startsWith('%%')) {
      lines.push(line)
      continue
    }

    // Check for subgraph start - handle both syntaxes
    const subgraphMatchId = trimmed.match(/^subgraph\s+(\w+)/)
    const subgraphMatchQuoted = trimmed.match(/^subgraph\s+"([^"]+)"/)

    if (subgraphMatchId || subgraphMatchQuoted) {
      let subgraphId: string

      if (subgraphMatchQuoted && !subgraphMatchId) {
        // Quoted label: generate ID from label
        const label = subgraphMatchQuoted[1]
        subgraphId = label.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
      } else if (subgraphMatchId) {
        subgraphId = subgraphMatchId[1]
      } else {
        lines.push(line)
        continue
      }

      if (inCollapsedSubgraph) {
        // We're inside a collapsed subgraph, track depth but skip content
        collapsedDepth++
        continue
      }

      if (collapsedIds.has(subgraphId)) {
        // Check if this collapsed subgraph has a collapsed parent
        const subgraph = parsed.subgraphs.find(sg => sg.id === subgraphId)
        const outermostAncestor = findOutermostCollapsedAncestor(parsed, subgraphId, collapsedIds)

        if (outermostAncestor === subgraphId) {
          // This is a top-level collapsed subgraph - emit placeholder
          if (subgraph) {
            const nodeCount = countSubgraphNodes(parsed, subgraphId)
            // Use simple rectangle shape to avoid Mermaid parse errors
            // Escape quotes in label to prevent syntax issues
            const safeLabel = subgraph.label.replace(/"/g, "'")
            const itemText = nodeCount === 1 ? '1 item' : `${nodeCount} items`
            // Add :::collapsedPulse class for CSS animation targeting
            const placeholder = `    ${subgraphId}["▶ ${safeLabel} • ${itemText}"]:::collapsedPulse`
            lines.push(placeholder)
            // Add click directive for this collapsed placeholder
            clickDirectives.push(`    click ${subgraphId} ${callbackName}`)
          }
        }
        // Either way, skip the content
        inCollapsedSubgraph = true
        collapsedDepth = 1
        continue
      }

      // Subgraph is not collapsed - check if inside a collapsed parent
      const subgraph = parsed.subgraphs.find(sg => sg.id === subgraphId)
      if (subgraph && subgraph.parentId && collapsedIds.has(subgraph.parentId)) {
        // Parent is collapsed, skip this
        continue
      }

      // Not collapsed, emit normally
      lines.push(line)
      continue
    }

    // Check for subgraph end
    if (trimmed === 'end') {
      if (inCollapsedSubgraph) {
        collapsedDepth--
        if (collapsedDepth === 0) {
          inCollapsedSubgraph = false
        }
        continue
      }
      lines.push(line)
      continue
    }

    // Skip content inside collapsed subgraphs
    if (inCollapsedSubgraph) {
      continue
    }

    // Preserve direction directives (e.g., direction LR inside subgraphs)
    if (trimmed.match(/^direction\s+(TD|TB|BT|LR|RL|DT)/i)) {
      lines.push(line)
      continue
    }

    // Handle linkStyle directives - filter if they target hidden edges
    const linkStyleMatch = trimmed.match(/^linkStyle\s+(\d+(?:\s*,\s*\d+)*)\s+/)
    if (linkStyleMatch) {
      // linkStyle uses edge indices - we'd need to track edge indices to filter properly
      // For now, pass through linkStyle as the edge indices may shift anyway
      // TODO: Future enhancement - track edge indices and filter appropriately
      lines.push(line)
      continue
    }

    // Handle edges - rewrite if needed (supports chained, parallel, and text arrows)
    const lineEdges = parseEdgeLine(trimmed, line)
    if (lineEdges.length > 0) {
      // Process each edge from this line
      const rewrittenEdges: ParsedEdge[] = []

      for (const edge of lineEdges) {
        const newSource = hiddenNodes.get(edge.source) || edge.source
        const newTarget = hiddenNodes.get(edge.target) || edge.target

        // Skip edges where both ends are in the same collapsed subgraph
        if (hiddenNodes.has(edge.source) && hiddenNodes.has(edge.target)) {
          const sourceParent = hiddenNodes.get(edge.source)
          const targetParent = hiddenNodes.get(edge.target)
          if (sourceParent === targetParent) {
            continue // Internal edge, skip it
          }
        }

        // Check for duplicate edges (same source->target already added)
        const isDuplicate = rewrittenEdges.some(
          e => e.source === newSource && e.target === newTarget
        )
        if (!isDuplicate) {
          rewrittenEdges.push({
            source: newSource,
            target: newTarget,
            label: edge.label,
            style: edge.style,
            originalLine: edge.originalLine,
          })
        }
      }

      // Emit rewritten edges
      for (const edge of rewrittenEdges) {
        const labelPart = edge.label ? `|${edge.label}| ` : ''
        lines.push(`    ${edge.source} ${edge.style} ${labelPart}${edge.target}`)
      }
      continue
    }

    // Other lines (node definitions, styles, etc.) - pass through unless hidden
    // Check if this is a node definition for a hidden node
    const nodeDefMatch = trimmed.match(/^(\w+)\s*[[({>]/)
    if (nodeDefMatch) {
      const nodeId = nodeDefMatch[1]
      if (hiddenNodes.has(nodeId)) {
        continue // Skip hidden node definitions
      }
    }

    // Check for style/class targeting hidden nodes
    const styleMatch = trimmed.match(/^(style|class)\s+(\w+)/)
    if (styleMatch && hiddenNodes.has(styleMatch[2])) {
      continue // Skip styles for hidden nodes
    }

    // Check for classDef targeting hidden nodes
    const classDefMatch = trimmed.match(/^classDef\s+(\w+)/)
    if (classDefMatch) {
      // classDef defines a class, always pass through
      lines.push(line)
      continue
    }

    lines.push(line)
  }

  // Add click directives at the end (Mermaid requires them after node definitions)
  if (clickDirectives.length > 0) {
    lines.push('')
    lines.push(...clickDirectives)
  }

  return lines.join('\n')
}
