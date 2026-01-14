/**
 * Solution Selector Component
 * Displays recommended solutions as cards for user selection
 */

import type { Solution, OrganizationalContext } from '../../api/recommend'

interface SolutionSelectorProps {
  solutions: Solution[]
  organizationalContext?: OrganizationalContext
  onSelect: (solutionId: string) => void
  isLoading?: boolean
  selectedId?: string
}

/**
 * Get score badge styles based on score value
 */
function getScoreBadgeStyles(score: number): string {
  if (score >= 80) return 'bg-green-500/20 text-green-400 border-green-500/30'
  if (score >= 60) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
  return 'bg-red-500/20 text-red-400 border-red-500/30'
}

/**
 * Format score for display
 */
function formatScore(score: number): string {
  return `${Math.round(score)}%`
}

/**
 * Solution card component
 */
function SolutionCard({
  solution,
  onSelect,
  isLoading,
  isSelected,
  usesPatterns,
}: {
  solution: Solution
  onSelect: (solutionId: string) => void
  isLoading?: boolean
  isSelected?: boolean
  usesPatterns: boolean
}) {
  return (
    <button
      onClick={() => onSelect(solution.solutionId)}
      disabled={isLoading}
      className={`w-full text-left p-4 rounded-lg border transition-all ${
        isSelected
          ? 'border-primary bg-primary/10'
          : usesPatterns
            ? 'border-green-500/30 bg-green-500/5 hover:border-green-500/50 hover:bg-green-500/10'
            : 'border-border bg-card hover:border-primary/50 hover:bg-muted/50'
      } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {/* Header with score and patterns badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getScoreBadgeStyles(solution.score)}`}>
            {formatScore(solution.score)} match
          </span>
          {usesPatterns && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
              Uses Org Patterns
            </span>
          )}
        </div>
        {isSelected && (
          <svg className="w-5 h-5 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-foreground mb-3">{solution.description}</p>

      {/* Primary resources */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {solution.primaryResources.map((resource, index) => (
          <span
            key={index}
            className="px-2 py-0.5 rounded text-xs font-mono bg-muted text-muted-foreground"
          >
            {resource}
          </span>
        ))}
      </div>

      {/* Reasons (collapsed by default, show first one) */}
      {solution.reasons.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">Why: </span>
          {solution.reasons[0]}
          {solution.reasons.length > 1 && (
            <span className="text-muted-foreground/70"> (+{solution.reasons.length - 1} more)</span>
          )}
        </div>
      )}

      {/* Applied patterns (if any) */}
      {solution.appliedPatterns.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-green-400">Patterns: </span>
            {solution.appliedPatterns.slice(0, 2).join(', ')}
            {solution.appliedPatterns.length > 2 && (
              <span className="text-muted-foreground/70"> (+{solution.appliedPatterns.length - 2} more)</span>
            )}
          </div>
        </div>
      )}
    </button>
  )
}

export function SolutionSelector({
  solutions,
  organizationalContext,
  onSelect,
  isLoading,
  selectedId,
}: SolutionSelectorProps) {
  // Sort solutions by score (highest first), with pattern-using solutions prioritized
  const sortedSolutions = [...solutions].sort((a, b) => {
    // Prioritize solutions using organizational patterns
    const aUsesPatterns = a.appliedPatterns.length > 0
    const bUsesPatterns = b.appliedPatterns.length > 0
    if (aUsesPatterns && !bUsesPatterns) return -1
    if (!aUsesPatterns && bUsesPatterns) return 1
    // Then sort by score
    return b.score - a.score
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Select a Solution</h2>
        {organizationalContext && organizationalContext.totalPatterns > 0 && (
          <span className="text-xs text-muted-foreground">
            {organizationalContext.solutionsUsingPatterns} of {organizationalContext.totalSolutions} use org patterns
          </span>
        )}
      </div>

      {/* Organizational context info */}
      {organizationalContext && (organizationalContext.totalPatterns > 0 || organizationalContext.totalPolicies > 0) && (
        <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            {organizationalContext.totalPatterns > 0 && (
              <span>
                <span className="font-medium text-foreground">{organizationalContext.totalPatterns}</span> patterns available
              </span>
            )}
            {organizationalContext.totalPolicies > 0 && (
              <span>
                <span className="font-medium text-foreground">{organizationalContext.totalPolicies}</span> policies checked
              </span>
            )}
          </div>
        </div>
      )}

      {/* Solutions grid */}
      <div className="grid gap-3 md:grid-cols-2">
        {sortedSolutions.map((solution) => (
          <SolutionCard
            key={solution.solutionId}
            solution={solution}
            onSelect={onSelect}
            isLoading={isLoading}
            isSelected={selectedId === solution.solutionId}
            usesPatterns={solution.appliedPatterns.length > 0}
          />
        ))}
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-sm">Loading questions...</span>
          </div>
        </div>
      )}
    </div>
  )
}
