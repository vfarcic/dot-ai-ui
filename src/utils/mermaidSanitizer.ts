/**
 * Mermaid source sanitizer.
 *
 * Diagram source comes from the MCP server / AI generation and must be treated as untrusted.
 * Mermaid supports interaction directives that turn diagram elements into live click actions:
 *
 *   click A "javascript:..."                 (flowchart/gantt/state link)
 *   click A href "https://..." _blank        (explicit link)
 *   click A someWindowFunction "tooltip"     (callback into any global function)
 *   click A call fn(arg)                     (callback with arguments)
 *   link Class "url" / callback Class "fn"   (class diagrams)
 *   link Actor: Label @ url / links Actor: {...}   (sequence diagram actor menus)
 *
 * The renderer never needs any of these from the source: collapse/expand interactions are
 * attached by the renderer itself as DOM listeners. So every interaction directive is dropped.
 *
 * This is one layer of defense. The renderer also runs Mermaid with `securityLevel: 'strict'`
 * (callbacks disabled, URLs sanitized) and passes the resulting SVG through DOMPurify.
 *
 * Matching is intentionally aggressive: statements are split on every newline, every `;` and
 * every directive terminator (`}%%`) without regard to quoting. Mermaid's own lexer may disagree
 * with a hand-written parser about where a string ends, and any disagreement must err toward
 * removing too much. The worst case for legitimate content (a label containing "; click ...")
 * is a diagram that fails to parse, never one that executes.
 */

/** `click` starts an interaction directive in every diagram type that supports one. */
const CLICK_STATEMENT = /^click(?:\s|$)/i

/**
 * `link`, `links` and `callback` are interaction keywords in class and sequence diagrams.
 * The negative lookahead keeps relationship/edge statements for an entity that happens to be
 * named `link` (e.g. `link --> Other`, `link <|-- Base`, `link o-- Part`).
 */
const LINK_STATEMENT = /^(?:links?|callback)\s+(?![-=.<>|*~&]|[ox][-.=])\S/i

/**
 * Diagram types whose free-text lines (task names, mindmap nodes, journey steps...) may
 * legitimately start with "Link ..." and where `link`/`callback` are not keywords.
 * Everything else, including sources whose type can't be determined, gets the link rule.
 */
const NO_LINK_KEYWORD_DIAGRAM =
  /^(?:graph|flowchart|gantt|mindmap|timeline|journey|pie|gitGraph|quadrantChart|xychart|sankey|kanban|block|architecture|packet|radar|treemap|erDiagram|stateDiagram|requirementDiagram|C4\w*)\b/i

/**
 * Statement boundaries: `;`, and the end of a `%%{...}%%` directive (Mermaid strips directives
 * before lexing, so `%%{init: {}}%%click A call x()` is a live click statement).
 * The capture group keeps the delimiters so untouched lines are reassembled byte-for-byte.
 */
const STATEMENT_BOUNDARY = /(;|\}%%)/

const COMMENT_OR_DIRECTIVE_LINE = /^\s*%%/

/**
 * Identify the diagram keyword from the first meaningful line, skipping YAML front matter,
 * comments, directives and blank lines.
 */
function diagramKeywordLine(lines: string[]): string {
  let i = 0
  if (lines[0]?.trim() === '---') {
    i = 1
    while (i < lines.length && lines[i].trim() !== '---') i++
    i++
  }
  for (; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed || COMMENT_OR_DIRECTIVE_LINE.test(trimmed)) continue
    return trimmed
  }
  return ''
}

export interface SanitizedMermaidSource {
  /** Source with every interaction directive removed. */
  code: string
  /** The directives that were removed, trimmed, in source order. */
  removed: string[]
}

/**
 * Remove every interaction directive (click/href/call/link/callback) from Mermaid source.
 *
 * Lines that contain no interaction statement are returned unchanged, so legitimate
 * diagrams render exactly as before.
 */
export function sanitizeMermaidSource(source: string): SanitizedMermaidSource {
  const lines = source.split('\n')
  const checkLinks = !NO_LINK_KEYWORD_DIAGRAM.test(diagramKeywordLine(lines))
  const removed: string[] = []

  const isInteraction = (statement: string): boolean => {
    // trim() also strips Unicode whitespace (NBSP, BOM...), matching the lexers' \s.
    const trimmed = statement.trim()
    return CLICK_STATEMENT.test(trimmed) || (checkLinks && LINK_STATEMENT.test(trimmed))
  }

  const sanitizedLines = lines.map(line => {
    // Even indices are statements, odd indices are the delimiters between them.
    const parts = line.split(STATEMENT_BOUNDARY)
    if (!parts.some((part, i) => i % 2 === 0 && isInteraction(part))) return line

    for (let i = 0; i < parts.length; i += 2) {
      if (isInteraction(parts[i])) {
        removed.push(parts[i].trim())
        parts[i] = ''
      }
    }
    return parts.join('')
  })

  return { code: sanitizedLines.join('\n'), removed }
}
