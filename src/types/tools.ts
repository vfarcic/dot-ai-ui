/**
 * MCP Tool request/response types
 */

// Version tool
export interface VersionResponse {
  version: string
  buildDate?: string
  gitCommit?: string
}

// Recommend tool
export interface RecommendRequest {
  intent: string
  stage?: 'recommend' | 'chooseSolution' | 'answerQuestion:required' | 'answerQuestion:basic' | 'answerQuestion:advanced' | 'answerQuestion:open' | 'generateManifests' | 'deployManifests'
  solutionId?: string
  answers?: Record<string, unknown>
  timeout?: number
  final?: boolean
}

// Remediate tool
export interface RemediateRequest {
  issue: string
  mode?: 'manual' | 'automatic'
  sessionId?: string
  executeChoice?: 1 | 2
  executedCommands?: string[]
  maxRiskLevel?: 'low' | 'medium' | 'high'
  confidenceThreshold?: number
}

// Operate tool
export interface OperateRequest {
  intent: string
  sessionId?: string
  executeChoice?: 1
  refinedIntent?: string
}

// ManageOrgData tool
export interface ManageOrgDataRequest {
  dataType: 'pattern' | 'policy' | 'capabilities'
  operation: 'create' | 'list' | 'get' | 'delete' | 'deleteAll' | 'scan' | 'analyze' | 'progress' | 'search'
  id?: string
  limit?: number
  mode?: 'full'
  resource?: {
    kind: string
    group: string
    apiVersion: string
  }
  resourceList?: string
  sessionId?: string
  step?: string
  response?: string
  collection?: string
}

// ProjectSetup tool
export interface ProjectSetupRequest {
  step?: 'discover' | 'reportScan' | 'generateScope'
  existingFiles?: string[]
  selectedScopes?: string[]
  sessionId?: string
  scope?: string
  answers?: Record<string, unknown>
}

// Generic tool call wrapper
export type ToolName = 'version' | 'recommend' | 'remediate' | 'operate' | 'manageOrgData' | 'projectSetup'

export interface ToolRequest<T = unknown> {
  toolName: ToolName
  params: T
}
