import { describe, it, expect } from 'vitest'
import { parseMermaid, generateCollapsedCode } from './mermaidParser'

describe('generateCollapsedCode', () => {
  const source = [
    'graph TD',
    '  subgraph services[Services Layer]',
    '    api[API] --> db[(Database)]',
    '  end',
    '  user[User] --> api',
  ].join('\n')

  it('replaces a collapsed subgraph with a placeholder and rewires its edges', () => {
    const code = generateCollapsedCode(parseMermaid(source), new Set(['services']))
    expect(code).toContain('services["▶ Services Layer • 2 items"]:::collapsedPulse')
    expect(code).toContain('user --> services')
    expect(code).not.toContain('db[(Database)]')
  })

  it('emits no click directives (placeholders are wired up by the renderer)', () => {
    const code = generateCollapsedCode(parseMermaid(source), new Set(['services']))
    expect(code).not.toMatch(/^\s*click\b/im)
  })
})
