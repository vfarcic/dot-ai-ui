import { useState } from 'react'

interface ExpandableDescriptionProps {
  description?: string
  useCase?: string
  loading?: boolean
}

/**
 * Expandable description component for resource kinds.
 * Shows a single truncated line by default, expands on click to show full description and use case.
 */
export function ExpandableDescription({
  description,
  useCase,
  loading = false,
}: ExpandableDescriptionProps) {
  const [expanded, setExpanded] = useState(false)

  // Show loading skeleton while fetching
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm animate-pulse">
        <div className="w-4 h-4 bg-muted rounded flex-shrink-0" />
        <div className="h-4 bg-muted rounded w-64" />
      </div>
    )
  }

  // If no description available, don't render anything
  if (!description && !useCase) {
    return null
  }

  const toggleExpanded = () => setExpanded(!expanded)

  return (
    <div className="text-sm">
      {expanded ? (
        // Expanded view - show full description and use case (entire area clickable)
        <button
          onClick={toggleExpanded}
          className="flex items-start gap-2 text-left text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <svg
            className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary"
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
          <div className="space-y-2">
            <span>{description}</span>
            {useCase && (
              <p>
                <span className="font-medium">Use case:</span>{' '}
                {useCase}
              </p>
            )}
          </div>
        </button>
      ) : (
        // Collapsed view - single truncated line
        <button
          onClick={toggleExpanded}
          className="flex items-center gap-2 text-left text-muted-foreground hover:text-foreground transition-colors cursor-pointer max-w-full"
        >
          <svg
            className="w-4 h-4 flex-shrink-0 text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          <span className="truncate">{description || useCase}</span>
        </button>
      )}
    </div>
  )
}
