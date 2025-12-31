/**
 * Visualization types for PRD #2 - Web UI Visualization Companion
 * Based on GET /api/v1/visualize/{sessionId} response format
 */

export interface Card {
  id: string
  title: string
  description?: string
  tags?: string[]
}

export interface CodeContent {
  language: string
  code: string
}

export interface TableContent {
  headers: string[]
  rows: string[][]
}

export type VisualizationType = 'mermaid' | 'cards' | 'code' | 'table'

export interface MermaidVisualization {
  id: string
  label: string
  type: 'mermaid'
  content: string
}

export interface CardsVisualization {
  id: string
  label: string
  type: 'cards'
  content: Card[]
}

export interface CodeVisualization {
  id: string
  label: string
  type: 'code'
  content: CodeContent
}

export interface TableVisualization {
  id: string
  label: string
  type: 'table'
  content: TableContent
}

export type Visualization =
  | MermaidVisualization
  | CardsVisualization
  | CodeVisualization
  | TableVisualization

export interface VisualizationResponse {
  title: string
  visualizations: Visualization[]
  insights?: string[]
  error: string | null
}

export interface VisualizationErrorResponse {
  error: string
}
