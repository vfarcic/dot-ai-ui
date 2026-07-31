import { describe, it, expect } from 'vitest'
import { classifyStatus, getStatusColorClasses, isStatusColumn } from './statusColors'

describe('classifyStatus', () => {
  it('classifies healthy states as good', () => {
    for (const value of ['Running', 'succeeded', 'ACTIVE', 'Bound', 'Synced', 'true']) {
      expect(classifyStatus(value)).toBe('good')
    }
  })

  it('classifies failure states as bad', () => {
    for (const value of ['Failed', 'error', 'CrashLoopBackOff', 'OOMKilled', 'ImagePullBackOff', 'false']) {
      expect(classifyStatus(value)).toBe('bad')
    }
  })

  it('classifies transitional states as warning', () => {
    for (const value of ['Pending', 'terminating', 'OutOfSync', 'Progressing', 'Unknown']) {
      expect(classifyStatus(value)).toBe('warning')
    }
  })

  it('falls back to neutral for empty, blank, and unrecognized values', () => {
    expect(classifyStatus(null)).toBe('neutral')
    expect(classifyStatus(undefined)).toBe('neutral')
    expect(classifyStatus('')).toBe('neutral')
    expect(classifyStatus('   ')).toBe('neutral')
    expect(classifyStatus('SomeCustomPhase')).toBe('neutral')
  })

  it('ignores surrounding whitespace', () => {
    expect(classifyStatus('  Running  ')).toBe('good')
  })

  it('matches BackOff-suffixed statuses beyond the known ones', () => {
    expect(classifyStatus('ErrImageNeverBackOff')).toBe('bad')
  })
})

describe('getStatusColorClasses', () => {
  it('maps every classification to a distinct class', () => {
    const classes = (['good', 'bad', 'warning', 'neutral'] as const).map(getStatusColorClasses)
    expect(classes).toEqual([
      'text-green-400',
      'text-red-400',
      'text-yellow-400',
      'text-muted-foreground',
    ])
    expect(new Set(classes).size).toBe(4)
  })
})

describe('isStatusColumn', () => {
  it('detects status columns by name, case-insensitively', () => {
    expect(isStatusColumn('Status', '.metadata.name')).toBe(true)
    expect(isStatusColumn('PHASE', '.metadata.name')).toBe(true)
    expect(isStatusColumn('synced', '.metadata.name')).toBe(true)
  })

  it('detects status columns by jsonPath when the name is generic', () => {
    expect(isStatusColumn('Value', '.status.phase')).toBe(true)
    expect(isStatusColumn('Value', '.status.sync.status')).toBe(true)
  })

  it('rejects non-status columns', () => {
    expect(isStatusColumn('Name', '.metadata.name')).toBe(false)
    expect(isStatusColumn('Age', '.metadata.creationTimestamp')).toBe(false)
    expect(isStatusColumn('Replicas', '.spec.replicas')).toBe(false)
  })
})
