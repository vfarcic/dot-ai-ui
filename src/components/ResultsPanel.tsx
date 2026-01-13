/**
 * Results Panel for displaying execution results
 * Shows success/failure status and command outputs
 */

import type { ExecutionResult } from '@/api/remediate'

interface ResultsPanelProps {
  results: ExecutionResult[]
  validation?: {
    success: boolean
    summary: string
  }
  message?: string
}

function getResultIcon(success: boolean) {
  if (success) {
    return (
      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    )
  }
  return (
    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

export function ResultsPanel({ results, validation, message }: ResultsPanelProps) {
  const allSuccessful = results.every((r) => r.success)
  const overallSuccess = validation?.success ?? allSuccessful

  return (
    <div
      className={`mt-4 p-4 rounded-lg border ${
        overallSuccess
          ? 'border-green-500/30 bg-green-500/10'
          : 'border-red-500/30 bg-red-500/10'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        {getResultIcon(overallSuccess)}
        <span className={`font-medium ${overallSuccess ? 'text-green-400' : 'text-red-400'}`}>
          {overallSuccess ? 'Execution Complete' : 'Execution Failed'}
        </span>
      </div>

      {message && <p className="text-sm text-foreground mb-3">{message}</p>}

      {/* Only show validation summary if it differs from the message */}
      {validation?.summary && validation.summary !== message && (
        <p className="text-sm text-muted-foreground mb-3">{validation.summary}</p>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Execution Details
          </div>
          {results.map((result, index) => (
            <div
              key={index}
              className={`p-3 rounded border ${
                result.success ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {getResultIcon(result.success)}
                <span className="text-sm font-medium">{result.action}</span>
              </div>
              {result.output && (
                <pre className="text-xs text-muted-foreground bg-background/50 p-2 rounded mt-2 overflow-x-auto">
                  {result.output}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
