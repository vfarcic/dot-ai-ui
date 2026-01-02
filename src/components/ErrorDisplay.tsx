import type { ReactNode } from 'react'
import type { ErrorType } from '@/api'
import { generateGitHubIssueUrl, GitHubIcon } from '@/utils/errorReporting'

interface ErrorDisplayProps {
  type: ErrorType
  message: string
  sessionId?: string
  onRetry?: () => void
}

const errorConfig: Record<
  ErrorType,
  { title: string; description: string; icon: ReactNode }
> = {
  'session-expired': {
    title: 'Session Expired',
    description:
      'This visualization session has expired or is no longer available. Return to your coding agent to generate a new visualization URL.',
    icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  'ai-unavailable': {
    title: 'AI Service Unavailable',
    description:
      'The AI visualization service is not configured on the server. Please contact your administrator.',
    icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  network: {
    title: 'Connection Failed',
    description:
      'Unable to connect to the server. Please check your network connection and try again.',
    icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a5 5 0 01-7.072-7.072m7.072 7.072L6.343 17.657M9.879 16.121L6.343 17.657m3.536-1.536L6.343 6.343m10.02 10.02L17.657 6.343"
        />
      </svg>
    ),
  },
  timeout: {
    title: 'Request Timed Out',
    description:
      'The visualization is taking longer than expected. This may happen for complex queries. Please try again.',
    icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  server: {
    title: 'Server Error',
    description:
      'Something went wrong while generating the visualization. Please try again.',
    icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    ),
  },
}

export function ErrorDisplay({ type, message, sessionId, onRetry }: ErrorDisplayProps) {
  const config = errorConfig[type]
  const showRetry = type !== 'session-expired' && onRetry

  const issueUrl = generateGitHubIssueUrl({
    errorName: config.title,
    errorMessage: message || config.description,
    component: 'Visualization',
  })

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center max-w-md px-4">
        <div className="text-destructive mb-4 flex justify-center opacity-80">
          {config.icon}
        </div>

        <h2 className="text-lg font-semibold text-foreground mb-2">{config.title}</h2>

        <p className="text-sm text-muted-foreground mb-4">{config.description}</p>

        {message && message !== config.description && (
          <p className="text-xs text-muted-foreground bg-muted/50 border border-border rounded px-3 py-2 mb-4">
            {message}
          </p>
        )}

        {sessionId && (
          <p className="text-xs text-muted-foreground mb-4">
            Session: <code className="bg-muted px-2 py-1 rounded">{sessionId}</code>
          </p>
        )}

        {showRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Try Again
          </button>
        )}

        {type === 'session-expired' && (
          <p className="text-xs text-muted-foreground mt-4">
            Return to your coding agent and run your query again to get a new visualization URL.
          </p>
        )}

        <a
          href={issueUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <GitHubIcon className="w-3.5 h-3.5" />
          Report Issue
        </a>
      </div>
    </div>
  )
}
