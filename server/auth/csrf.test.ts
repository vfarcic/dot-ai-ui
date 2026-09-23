// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { checkCsrf } from './csrf.js'

const hosts = ['ui.example.com', 'dot-ai-ui.internal:3000']

describe('checkCsrf', () => {
  it('never blocks safe methods, whatever the headers say', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      expect(checkCsrf({ method, secFetchSite: 'cross-site', origin: 'https://evil.example', allowedHosts: hosts }))
        .toEqual({ allowed: true })
    }
  })

  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'post'])('applies to %s', (method) => {
    expect(checkCsrf({ method, secFetchSite: 'cross-site', allowedHosts: hosts }).allowed).toBe(false)
  })

  it('allows same-origin and user-initiated (none) fetch metadata', () => {
    expect(checkCsrf({ method: 'POST', secFetchSite: 'same-origin', allowedHosts: hosts }).allowed).toBe(true)
    expect(checkCsrf({ method: 'POST', secFetchSite: 'None', allowedHosts: hosts }).allowed).toBe(true)
  })

  it('rejects same-site (sibling subdomain) and cross-site fetch metadata', () => {
    expect(checkCsrf({ method: 'POST', secFetchSite: 'same-site', allowedHosts: hosts })).toEqual({
      allowed: false,
      reason: 'Sec-Fetch-Site: same-site',
    })
    expect(checkCsrf({ method: 'DELETE', secFetchSite: 'cross-site', allowedHosts: hosts }).allowed).toBe(false)
  })

  it('lets Sec-Fetch-Site win over a matching Origin', () => {
    expect(
      checkCsrf({ method: 'POST', secFetchSite: 'cross-site', origin: 'https://ui.example.com', allowedHosts: hosts })
        .allowed
    ).toBe(false)
  })

  it('falls back to Origin, which must match the request host including port', () => {
    expect(checkCsrf({ method: 'POST', origin: 'https://ui.example.com', allowedHosts: hosts }).allowed).toBe(true)
    expect(checkCsrf({ method: 'POST', origin: 'http://localhost:3000', allowedHosts: ['localhost:3000'] }).allowed)
      .toBe(true)
    expect(checkCsrf({ method: 'POST', origin: 'http://localhost:4000', allowedHosts: ['localhost:3000'] }).allowed)
      .toBe(false)
    expect(checkCsrf({ method: 'POST', origin: 'https://evil.example', allowedHosts: hosts })).toEqual({
      allowed: false,
      reason: 'cross-origin',
    })
  })

  it('rejects opaque and malformed origins', () => {
    expect(checkCsrf({ method: 'POST', origin: 'null', allowedHosts: hosts })).toEqual({
      allowed: false,
      reason: 'opaque origin',
    })
    expect(checkCsrf({ method: 'POST', origin: 'not a url', allowedHosts: hosts })).toEqual({
      allowed: false,
      reason: 'malformed origin',
    })
  })

  it('allows requests with neither header (non-browser clients)', () => {
    expect(checkCsrf({ method: 'POST', allowedHosts: hosts }).allowed).toBe(true)
  })
})
