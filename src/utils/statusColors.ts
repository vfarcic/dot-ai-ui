/**
 * Pattern-based status classification for Kubernetes resource values.
 * Uses regex patterns to classify status values as good (green), bad (red),
 * warning (yellow), or neutral (default).
 */

export type StatusClassification = 'good' | 'bad' | 'warning' | 'neutral'

// Regex patterns for status classification
const STATUS_PATTERNS: Record<Exclude<StatusClassification, 'neutral'>, RegExp[]> = {
  // Green - healthy/success states
  good: [
    /^running$/i,
    /^succeeded$/i,
    /^active$/i,
    /^healthy$/i,
    /^ready$/i,
    /^bound$/i,
    /^synced$/i,
    /^complete$/i,
    /^completed$/i,
    /^available$/i,
    /^established$/i,
    /^true$/i,
  ],

  // Red - error/failure states
  bad: [
    /^failed$/i,
    /^error$/i,
    /crashloop/i,
    /backoff$/i,
    /^degraded$/i,
    /^unhealthy$/i,
    /^unavailable$/i,
    /^terminated$/i,
    /^evicted$/i,
    /^false$/i,
    /^lost$/i,
    /^oomkilled$/i,
    /^imagepull/i,
    /^errimagepull$/i,
    /^invalidimage/i,
  ],

  // Yellow - transitional/warning states
  warning: [
    /^pending$/i,
    /^terminating$/i,
    /^unknown$/i,
    /^outofsync$/i,
    /^progressing$/i,
    /^waiting$/i,
    /^creating$/i,
    /^scaling$/i,
    /^updating$/i,
    /^deleting$/i,
    /^suspended$/i,
    /^paused$/i,
  ],
}

/**
 * Classify a status value based on pattern matching.
 * Returns the classification type for styling purposes.
 */
export function classifyStatus(value: string | null | undefined): StatusClassification {
  if (!value || typeof value !== 'string') return 'neutral'

  const trimmed = value.trim()
  if (!trimmed) return 'neutral'

  // Check each classification in priority order
  for (const [classification, patterns] of Object.entries(STATUS_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) {
        return classification as StatusClassification
      }
    }
  }

  return 'neutral'
}

/**
 * Get Tailwind CSS classes for a status classification.
 */
export function getStatusColorClasses(classification: StatusClassification): string {
  switch (classification) {
    case 'good':
      return 'text-green-400'
    case 'bad':
      return 'text-red-400'
    case 'warning':
      return 'text-yellow-400'
    case 'neutral':
    default:
      return 'text-muted-foreground'
  }
}

/**
 * Check if a column is likely a status column based on its name or jsonPath.
 */
export function isStatusColumn(columnName: string, jsonPath: string): boolean {
  const nameLower = columnName.toLowerCase()
  const pathLower = jsonPath.toLowerCase()

  // Column name indicators
  if (
    nameLower === 'status' ||
    nameLower === 'phase' ||
    nameLower === 'state' ||
    nameLower === 'ready' ||
    nameLower === 'available' ||
    nameLower === 'condition' ||
    nameLower === 'health' ||
    nameLower === 'synced'
  ) {
    return true
  }

  // JSONPath indicators - status field values
  if (
    pathLower.includes('.status.phase') ||
    pathLower.includes('.status.state') ||
    pathLower.includes('.status.health') ||
    pathLower.includes('.status.sync')
  ) {
    return true
  }

  return false
}
