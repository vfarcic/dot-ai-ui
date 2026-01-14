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

/**
 * Template for Operate tool response
 * Shows proposed changes, risk assessment, commands, and AI context
 */
export const OPERATE_TEMPLATE: InfoTemplate = [
  {
    type: 'heading',
    text: 'Operation Summary',
    level: 2,
  },
  {
    type: 'text',
    field: 'analysis.summary',
  },
  {
    type: 'heading',
    text: 'Risk Assessment',
    badge: { field: 'analysis.risks.level', format: 'risk' },
    level: 3,
  },
  {
    type: 'text',
    field: 'analysis.risks.description',
  },
  {
    type: 'heading',
    text: 'Proposed Changes',
    level: 2,
  },
  {
    type: 'changes-list',
    field: 'analysis.proposedChanges',
  },
  {
    type: 'heading',
    text: 'Commands',
    level: 3,
  },
  {
    type: 'code-list',
    field: 'analysis.commands',
  },
  {
    type: 'heading',
    text: 'Validation',
    level: 3,
  },
  {
    type: 'key-value',
    items: [
      { label: 'Dry Run', field: 'analysis.dryRunValidation.status' },
      { label: 'Details', field: 'analysis.dryRunValidation.details' },
    ],
  },
  {
    type: 'heading',
    text: 'AI Context',
    level: 3,
  },
  {
    type: 'list',
    field: 'analysis.patternsApplied',
    severity: 'info',
  },
  {
    type: 'list',
    field: 'analysis.policiesChecked',
    severity: 'info',
  },
]

/**
 * Template for Recommend tool solution display
 * Shows selected solution details before proceeding to questions
 */
export const RECOMMEND_SOLUTION_TEMPLATE: InfoTemplate = [
  {
    type: 'heading',
    text: 'Selected Solution',
    badge: { field: 'score', format: 'percent' },
    level: 2,
  },
  {
    type: 'text',
    field: 'description',
  },
  {
    type: 'heading',
    text: 'Kubernetes Resources',
    level: 3,
  },
  {
    type: 'list',
    field: 'primaryResources',
    severity: 'info',
  },
  {
    type: 'heading',
    text: 'Why This Solution',
    level: 3,
  },
  {
    type: 'list',
    field: 'reasons',
    severity: 'info',
  },
  {
    type: 'heading',
    text: 'Organizational Patterns Applied',
    level: 3,
  },
  {
    type: 'list',
    field: 'appliedPatterns',
    severity: 'success',
  },
  {
    type: 'heading',
    text: 'Policies Checked',
    level: 3,
  },
  {
    type: 'list',
    field: 'relevantPolicies',
    severity: 'info',
  },
]
