/**
 * Utility for generating GitHub issue URLs with pre-filled diagnostic info.
 * Used for "Report Issue" links in error states.
 *
 * Privacy: Excludes actual content (diagrams, visualizations) that may contain
 * sensitive information. Only includes diagnostic metadata.
 */

export interface ErrorReportContext {
  errorName: string
  errorMessage: string
  component: string
}

const GITHUB_REPO = 'vfarcic/dot-ai-ui'

/**
 * Get readable browser and OS information.
 * Uses User-Agent Client Hints API when available for accuracy,
 * falls back to parsing userAgent string.
 */
function getBrowserInfo(): string {
  if (typeof navigator === 'undefined') return 'N/A'

  // Try User-Agent Client Hints API (more accurate, especially for Apple Silicon)
  const uaData = (navigator as Navigator & { userAgentData?: { brands?: Array<{ brand: string; version: string }>; platform?: string } }).userAgentData
  if (uaData) {
    const brands = uaData.brands || []
    // Filter out "Not" brands which are grease values
    const browser = brands.find(b => !b.brand.includes('Not'))
    const browserStr = browser ? `${browser.brand} ${browser.version}` : 'Unknown browser'
    const platform = uaData.platform || 'Unknown OS'
    return `${browserStr} on ${platform}`
  }

  // Fallback: parse userAgent string
  const ua = navigator.userAgent
  let browser = 'Unknown browser'
  let os = 'Unknown OS'

  // Detect browser
  if (ua.includes('Chrome/')) {
    const match = ua.match(/Chrome\/(\d+)/)
    browser = match ? `Chrome ${match[1]}` : 'Chrome'
  } else if (ua.includes('Firefox/')) {
    const match = ua.match(/Firefox\/(\d+)/)
    browser = match ? `Firefox ${match[1]}` : 'Firefox'
  } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    const match = ua.match(/Version\/(\d+)/)
    browser = match ? `Safari ${match[1]}` : 'Safari'
  } else if (ua.includes('Edg/')) {
    const match = ua.match(/Edg\/(\d+)/)
    browser = match ? `Edge ${match[1]}` : 'Edge'
  }

  // Detect OS
  if (ua.includes('Mac OS X')) {
    os = 'macOS'
  } else if (ua.includes('Windows')) {
    os = 'Windows'
  } else if (ua.includes('Linux')) {
    os = 'Linux'
  } else if (ua.includes('Android')) {
    os = 'Android'
  } else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) {
    os = 'iOS'
  }

  return `${browser} on ${os}`
}

/**
 * Generates a GitHub issue URL with pre-filled diagnostic information.
 * Opens the "new issue" page with title and body pre-populated.
 */
export function generateGitHubIssueUrl(context: ErrorReportContext): string {
  const { errorName, errorMessage, component } = context

  const title = `Error: ${errorName} in ${component}`

  const body = `## Error Details

**Error**: ${errorMessage}
**Component**: ${component}
**Route**: ${typeof window !== 'undefined' ? window.location.pathname : 'N/A'}
**Timestamp**: ${new Date().toISOString()}

## Environment

**Browser**: ${getBrowserInfo()}

## Steps to Reproduce

<!-- Please describe what you were doing when this error occurred -->

1.
2.
3.

## Additional Context

<!-- Any other relevant information that might help debug this issue -->
`

  const params = new URLSearchParams({
    title,
    body,
    labels: 'bug',
  })

  return `https://github.com/${GITHUB_REPO}/issues/new?${params.toString()}`
}

/**
 * GitHub icon component for use in "Report Issue" links.
 * Returns an SVG element as a string for flexibility.
 */
export function GitHubIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
        clipRule="evenodd"
      />
    </svg>
  )
}
