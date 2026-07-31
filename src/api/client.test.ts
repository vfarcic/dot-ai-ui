import { describe, it, expect, vi, beforeEach } from 'vitest'
import { APIError, getVisualization } from './client'
import { fetchWithAuth } from './authHeaders'

vi.mock('./authHeaders', () => ({
  fetchWithAuth: vi.fn(),
}))

const mockFetch = vi.mocked(fetchWithAuth)

function jsonResponse(body: unknown, init: { status?: number; statusText?: string } = {}) {
  const status = init.status ?? 200
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: init.statusText ?? 'OK',
    json: async () => body,
  } as unknown as Response
}

describe('APIError classification', () => {
  it('treats only the explicit SESSION_NOT_FOUND code as session-expired', () => {
    const withCode = new APIError('gone', 404, 'Not Found', 'SESSION_NOT_FOUND')
    expect(withCode.errorType).toBe('session-expired')

    // Regression guard: a bare 404 must NOT be session-expired. Vite HMR restarts
    // produce generic 404s and used to surface as false "session expired" errors.
    const bare404 = new APIError('gone', 404, 'Not Found')
    expect(bare404.errorType).toBe('server')
  })

  it('classifies the remaining error shapes', () => {
    expect(new APIError('x', 503, 'Unavailable').errorType).toBe('ai-unavailable')
    expect(new APIError('x', 500, 'Error', 'AI_NOT_CONFIGURED').errorType).toBe('ai-unavailable')
    expect(new APIError('x', 403, 'Forbidden').errorType).toBe('permission-denied')
    expect(new APIError('x', 408, 'Timeout').errorType).toBe('timeout')
    expect(new APIError('x', 0, 'Network Error').errorType).toBe('network')
    expect(new APIError('x', 500, 'Server Error').errorType).toBe('server')
  })

  it('marks everything retryable except session-expired and permission-denied', () => {
    expect(new APIError('x', 404, 'Not Found', 'SESSION_NOT_FOUND').isRetryable).toBe(false)
    expect(new APIError('x', 403, 'Forbidden').isRetryable).toBe(false)
    expect(new APIError('x', 500, 'Server Error').isRetryable).toBe(true)
    expect(new APIError('x', 0, 'Network Error').isRetryable).toBe(true)
  })
})

describe('getVisualization', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('unwraps the MCP { success, data } envelope', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true, data: { title: 'Deploy' } }))

    await expect(getVisualization('abc')).resolves.toEqual({ title: 'Deploy' })
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/visualize/abc', expect.anything())
  })

  it('returns the body as-is when it is not enveloped', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ title: 'Deploy' }))

    await expect(getVisualization('abc')).resolves.toEqual({ title: 'Deploy' })
  })

  it('appends reload=true only when requested', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: {} }))

    await getVisualization('abc', { reload: true })
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/visualize/abc?reload=true', expect.anything())
  })

  it('propagates the MCP error code and message from the response body', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(
        { error: { code: 'SESSION_NOT_FOUND', message: 'Session abc not found' } },
        { status: 404, statusText: 'Not Found' }
      )
    )

    await expect(getVisualization('abc')).rejects.toMatchObject({
      name: 'APIError',
      message: 'Session abc not found',
      errorCode: 'SESSION_NOT_FOUND',
      errorType: 'session-expired',
    })
  })

  it('falls back to a status-based message when the error body is unparsable', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => {
        throw new Error('not json')
      },
    } as unknown as Response)

    await expect(getVisualization('abc')).rejects.toMatchObject({
      message: 'API request failed: 500 Internal Server Error',
      errorType: 'server',
    })
  })

  it('maps an aborted request to a timeout error', async () => {
    const abort = new Error('The operation was aborted')
    abort.name = 'AbortError'
    mockFetch.mockRejectedValue(abort)

    await expect(getVisualization('abc')).rejects.toMatchObject({
      status: 408,
      errorType: 'timeout',
    })
  })

  it('maps a connection failure to a network error', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(getVisualization('abc')).rejects.toMatchObject({
      status: 0,
      errorType: 'network',
    })
  })

  it('wraps non-Error rejections', async () => {
    mockFetch.mockRejectedValue('boom')

    await expect(getVisualization('abc')).rejects.toMatchObject({
      message: 'Unknown error',
      errorType: 'network',
    })
  })
})
