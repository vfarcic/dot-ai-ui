import { useState } from 'react'

interface InsightsPanelProps {
  sessionId: string
  insights?: string[]
}

export function InsightsPanel({ sessionId, insights }: InsightsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const hasInsights = insights && insights.length > 0

  return (
    <div className="bg-muted/50 border border-border rounded-lg mb-6 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/70 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg
            className="w-5 h-5 text-primary flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-sm font-medium text-foreground">
            Session & Insights
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-border pt-3">
          <div className="mb-3">
            <span className="text-xs text-muted-foreground">Session: </span>
            <code className="bg-muted px-2 py-1 rounded text-xs">{sessionId}</code>
          </div>

          {hasInsights && (
            <div>
              <h3 className="text-xs text-muted-foreground mb-2">Insights</h3>
              <ul className="space-y-1.5">
                {insights.map((insight, index) => (
                  <li
                    key={index}
                    className="text-sm text-muted-foreground flex items-start gap-2"
                  >
                    <span className="text-primary mt-0.5">•</span>
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!hasInsights && (
            <p className="text-sm text-muted-foreground italic">No insights available</p>
          )}
        </div>
      )}
    </div>
  )
}
