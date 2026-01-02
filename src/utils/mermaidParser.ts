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
 * Extract node IDs from a block of Mermaid content.
 * Matches various node shapes: [], (), {}, (()), [[]], etc.
 */
export function extractNodeIds(content: string): string[] {
  const nodeIds: string[] = []

  // Remove comments
  const withoutComments = content.replace(/%%.*$/gm, '')

  // Match node definitions with various shapes
  // Patterns: A[text], B(text), C{text}, D((text)), E[[text]], F>text], G{{text}}
  const nodePatterns = [
    /(\w+)\s*\[(?:[^\[\]]|\[[^\]]*\])*\]/g,     // A[text] or A[[text]]
    /(\w+)\s*\((?:[^()]|\([^)]*\))*\)/g,        // B(text) or B((text))
    /(\w+)\s*\{(?:[^{}]|\{[^}]*\})*\}/g,        // C{text} or C{{text}}
    /(\w+)\s*>\s*[^\]]+\]/g,                     // D>text]
  ]

  for (const pattern of nodePatterns) {
    let match
    while ((match = pattern.exec(withoutComments)) !== null) {
      const nodeId = match[1]
      // Exclude keywords
      if (!['subgraph', 'end', 'graph', 'flowchart', 'direction', 'style', 'class', 'click', 'linkStyle'].includes(nodeId.toLowerCase())) {
        if (!nodeIds.includes(nodeId)) {
          nodeIds.push(nodeId)
        }
      }
    }
  }

  // Also match nodes that appear in edges without explicit shape definition
  // e.g., A --> B where B might not have a shape defined yet
  const edgePattern = /(\w+)\s*(?:-->|---|-\.-|===|--[^>]|-.->|\s*--\s*[^>])/g
  let edgeMatch
  while ((edgeMatch = edgePattern.exec(withoutComments)) !== null) {
    const nodeId = edgeMatch[1]
    if (!['subgraph', 'end', 'graph', 'flowchart', 'direction', 'style', 'class', 'click', 'linkStyle'].includes(nodeId.toLowerCase())) {
      if (!nodeIds.includes(nodeId)) {
        nodeIds.push(nodeId)
      }
    }
  }

  // Match target of edges: --> B or --> B[text]
  const targetPattern = /(?:-->|---|-\.-|===|-.->)\s*(?:\|[^|]*\|\s*)?(\w+)/g
  let targetMatch
  while ((targetMatch = targetPattern.exec(withoutComments)) !== null) {
    const nodeId = targetMatch[1]
    if (!['subgraph', 'end', 'graph', 'flowchart', 'direction', 'style', 'class', 'click', 'linkStyle'].includes(nodeId.toLowerCase())) {
      if (!nodeIds.includes(nodeId)) {
        nodeIds.push(nodeId)
      }
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

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum]
    const trimmedLine = line.trim()

    // Skip comments
    if (trimmedLine.startsWith('%%')) {
      currentIndex += line.length + 1 // +1 for newline
      continue
    }

    // Check for subgraph start
    // Patterns: "subgraph id[label]", "subgraph id [label]", "subgraph id"
    const subgraphMatch = trimmedLine.match(/^subgraph\s+(\w+)(?:\s*\[([^\]]*)\])?/)

    if (subgraphMatch) {
      const id = subgraphMatch[1]
      const label = subgraphMatch[2] || id // Use id as label if not specified
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
 * Extract all edges from Mermaid flowchart code
 */
export function extractEdges(code: string): ParsedEdge[] {
  const edges: ParsedEdge[] = []
  const lines = code.split('\n')

  // Edge patterns to match various Mermaid arrow styles
  // Pattern: source ARROW target or source ARROW|label| target
  const edgeRegex = /^\s*(\w+)\s*(-->|---|-\.->|-\.-|==>|===|--[ox]|o--o|x--x|<-->)\s*(?:\|([^|]*)\|\s*)?(\w+)/

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip comments, subgraph declarations, and keywords
    if (trimmed.startsWith('%%') ||
        trimmed.startsWith('subgraph') ||
        trimmed === 'end' ||
        trimmed.match(/^(graph|flowchart)\s+/i)) {
      continue
    }

    const match = trimmed.match(edgeRegex)
    if (match) {
      edges.push({
        source: match[1],
        target: match[4],
        label: match[3] || undefined,
        style: match[2],
        originalLine: line,
      })
    }
  }

  return edges
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

  // Process each collapsed subgraph
  for (const collapsedId of collapsedIds) {
    collectNodes(collapsedId, collapsedId)
  }

  return hiddenNodes
}

/**
 * Generate modified Mermaid code with collapsed subgraphs replaced by placeholders
 */
export function generateCollapsedCode(
  parsed: ParsedMermaid,
  collapsedIds: Set<string>
): string {
  // If no subgraphs to collapse, return original
  if (collapsedIds.size === 0 || parsed.type !== 'flowchart') {
    return parsed.originalCode
  }

  const lines: string[] = []
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

    // Check for subgraph start
    const subgraphMatch = trimmed.match(/^subgraph\s+(\w+)/)
    if (subgraphMatch) {
      const subgraphId = subgraphMatch[1]

      if (inCollapsedSubgraph) {
        // We're inside a collapsed subgraph, track depth but skip content
        collapsedDepth++
        continue
      }

      if (collapsedIds.has(subgraphId)) {
        // This subgraph is collapsed - emit placeholder and skip content
        const subgraph = parsed.subgraphs.find(sg => sg.id === subgraphId)
        if (subgraph) {
          const nodeCount = countSubgraphNodes(parsed, subgraphId)
          const placeholder = `    ${subgraphId}[["▶ ${subgraph.label} (${nodeCount} items)"]]`
          lines.push(placeholder)
        }
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

    // Handle edges - rewrite if needed
    const edgeMatch = trimmed.match(/^\s*(\w+)\s*(-->|---|-\.->|-\.-|==>|===|--[ox]|o--o|x--x|<-->)\s*(?:\|([^|]*)\|\s*)?(\w+)/)
    if (edgeMatch) {
      const source = edgeMatch[1]
      const style = edgeMatch[2]
      const label = edgeMatch[3]
      const target = edgeMatch[4]

      const newSource = hiddenNodes.get(source) || source
      const newTarget = hiddenNodes.get(target) || target

      // Skip edges where both ends are in the same collapsed subgraph
      if (hiddenNodes.has(source) && hiddenNodes.has(target)) {
        const sourceParent = hiddenNodes.get(source)
        const targetParent = hiddenNodes.get(target)
        if (sourceParent === targetParent) {
          continue // Internal edge, skip it
        }
      }

      // Reconstruct edge with potentially new source/target
      const labelPart = label ? `|${label}| ` : ''
      lines.push(`    ${newSource} ${style} ${labelPart}${newTarget}`)
      continue
    }

    // Other lines (node definitions, styles, etc.) - pass through unless hidden
    // Check if this is a node definition for a hidden node
    const nodeDefMatch = trimmed.match(/^(\w+)\s*[\[\(\{>]/)
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

    lines.push(line)
  }

  return lines.join('\n')
}
