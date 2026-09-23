// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { checkCsrf, isSameOriginRequest } from './csrf.js'

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

describe('isSameOriginRequest', () => {
  it('trusts same-origin and user-initiated (none) fetch metadata', () => {
    expect(isSameOriginRequest({ secFetchSite: 'same-origin', allowedHosts: hosts })).toBe(true)
    expect(isSameOriginRequest({ secFetchSite: ' None ', allowedHosts: hosts })).toBe(true)
  })

  it('rejects cross-site and same-site fetch metadata, whatever Origin/Referer claim', () => {
    for (const secFetchSite of ['cross-site', 'same-site']) {
      expect(isSameOriginRequest({
        secFetchSite,
        origin: 'https://ui.example.com',
        referer: 'https://ui.example.com/dashboard',
        allowedHosts: hosts,
      })).toBe(false)
    }
  })

  it('without fetch metadata, accepts an Origin or Referer on this host', () => {
    expect(isSameOriginRequest({ origin: 'https://UI.example.com', allowedHosts: hosts })).toBe(true)
    expect(isSameOriginRequest({ referer: 'http://dot-ai-ui.internal:3000/dashboard?x=1', allowedHosts: hosts })).toBe(true)
  })

  it('without fetch metadata, rejects an Origin or Referer on another host', () => {
    expect(isSameOriginRequest({ origin: 'https://evil.example', allowedHosts: hosts })).toBe(false)
    expect(isSameOriginRequest({ referer: 'https://evil.example/page', allowedHosts: hosts })).toBe(false)
    expect(isSameOriginRequest({ referer: 'https://ui.example.com.evil.example/', allowedHosts: hosts })).toBe(false)
    // Origin is more authoritative than Referer
    expect(isSameOriginRequest({
      origin: 'https://evil.example',
      referer: 'https://ui.example.com/',
      allowedHosts: hosts,
    })).toBe(false)
  })

  it('fails closed with no signal, an opaque origin or unparseable headers', () => {
    expect(isSameOriginRequest({ allowedHosts: hosts })).toBe(false)
    expect(isSameOriginRequest({ origin: 'null', allowedHosts: hosts })).toBe(false)
    expect(isSameOriginRequest({ referer: 'not a url', allowedHosts: hosts })).toBe(false)
    expect(isSameOriginRequest({ origin: 'https://ui.example.com', allowedHosts: [''] })).toBe(false)
  })
})
