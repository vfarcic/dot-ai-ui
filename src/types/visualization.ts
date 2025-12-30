/**
 * Typed content blocks for MCP visualization responses
 * Based on PRD specification
 */

export interface Card {
  id: string
  title: string
  description?: string
  tags?: string[]
  metadata?: Record<string, string>
}

export interface ImageData {
  format: 'svg' | 'png'
  content: string
  alt: string
  source?: 'mermaid' | 'graphviz'
}

export interface GraphNode {
  id: string
  label: string
  category?: string
  metadata?: Record<string, unknown>
}

export interface GraphEdge {
  from: string
  to: string
  label?: string
  relationship?: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface TreeNode {
  id: string
  label: string
  children?: TreeNode[]
}

export interface Step {
  label: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  description?: string
}

export type Visualization =
  | { type: 'text'; data: string }
  | { type: 'code'; data: { content: string; language: string } }
  | { type: 'table'; data: { headers: string[]; rows: string[][] } }
  | { type: 'cards'; data: { items: Card[] } }
  | { type: 'image'; data: ImageData }
  | { type: 'graph'; data: GraphData }
  | { type: 'tree'; data: { root: TreeNode } }
  | { type: 'diff'; data: { before: string; after: string } }
  | { type: 'progress'; data: { steps: Step[]; current: number } }

export interface WorkflowState {
  sessionId: string
  progress?: {
    current: number
    total: number
    label?: string
  }
}

export interface MCPVisualizationResponse {
  message: string
  visualizations?: Visualization[]
  prompt?: string
  workflow?: WorkflowState
}
