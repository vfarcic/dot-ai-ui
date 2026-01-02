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
