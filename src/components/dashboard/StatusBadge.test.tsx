import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { type ResourceStatus } from '../../data/mockK8sData'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('renders the status text', () => {
    render(<StatusBadge status="Running" />)
    expect(screen.getByText('Running')).toBeInTheDocument()
  })

  it('colors healthy, transitional, and failed states differently', () => {
    const colorOf = (status: ResourceStatus) => {
      const { unmount } = render(<StatusBadge status={status} />)
      const className = screen.getByText(status).className
      unmount()
      return className
    }

    expect(colorOf('Running')).toContain('text-green-400')
    expect(colorOf('Pending')).toContain('text-yellow-400')
    expect(colorOf('CrashLoopBackOff')).toContain('text-red-400')
  })

  it('falls back to the Unknown styling for an unmapped status', () => {
    // Cast models bad data arriving from the cluster, which the component guards against.
    render(<StatusBadge status={'Bogus' as ResourceStatus} />)
    expect(screen.getByText('Bogus').className).toContain('text-gray-400')
  })
})
