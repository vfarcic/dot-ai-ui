/**
 * Visualization types for PRD #2 - Web UI Visualization Companion
 * Based on GET /api/v1/visualize/{sessionId} response format
 */

export type StatusIndicator = 'error' | 'warning' | 'ok'

export interface Card {
  id: string
  title: string
  description?: string
  tags?: string[]
  status?: StatusIndicator
}

export interface CodeContent {
  language: string
  code: string
}

export interface TableContent {
  headers: string[]
  rows: string[][]
  rowStatuses?: (StatusIndicator | null)[]
}

export interface BarChartBar {
  label: string
  value: number
  max?: number
  status?: StatusIndicator
}

export interface BarChartContent {
  title?: string
  data: BarChartBar[]
  unit?: string
  orientation?: 'horizontal' | 'vertical'
}

export type VisualizationType = 'mermaid' | 'cards' | 'code' | 'table' | 'bar-chart'

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

export interface BarChartVisualization {
  id: string
  label: string
  type: 'bar-chart'
  content: BarChartContent
}

export type Visualization =
  | MermaidVisualization
  | CardsVisualization
  | CodeVisualization
  | TableVisualization
  | BarChartVisualization

export interface VisualizationResponse {
  title: string
  visualizations: Visualization[]
  insights?: string[]
}
