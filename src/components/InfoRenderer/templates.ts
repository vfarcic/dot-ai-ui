/**
 * Tool-specific templates for InfoRenderer
 * Each tool defines how its response data should be displayed
 */

import type { InfoTemplate } from './types'

/**
 * Template for Remediate tool response
 * Maps analysis and remediation fields to display blocks
 */
export const REMEDIATE_TEMPLATE: InfoTemplate = [
  {
    type: 'heading',
    text: 'Root Cause',
    badge: { field: 'analysis.confidence', format: 'percent' },
    level: 2,
  },
  {
    type: 'text',
    field: 'analysis.rootCause',
  },
  {
    type: 'heading',
    text: 'Contributing Factors',
    level: 3,
  },
  {
    type: 'list',
    field: 'analysis.factors',
    severity: 'warning',
  },
  {
    type: 'heading',
    text: 'Recommended Actions',
    level: 2,
  },
  {
    type: 'text',
    field: 'remediation.summary',
  },
  {
    type: 'actions-list',
    field: 'remediation.actions',
    showCommand: true,
    showRisk: true,
  },
]

/**
 * Template for Remediate results (after execution)
 */
export const REMEDIATE_RESULTS_TEMPLATE: InfoTemplate = [
  {
    type: 'heading',
    text: 'Execution Results',
    level: 2,
  },
  {
    type: 'text',
    field: 'message',
    severity: 'success',
  },
]
