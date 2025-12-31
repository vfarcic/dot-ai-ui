import { useEffect, useRef } from 'react'
import Prism from 'prismjs'
import type { CodeContent } from '@/types'

// Import common languages
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-docker'

interface CodeRendererProps {
  content: CodeContent
}

// Map common language aliases
const languageAliases: Record<string, string> = {
  yml: 'yaml',
  sh: 'bash',
  shell: 'bash',
  ts: 'typescript',
  js: 'javascript',
  dockerfile: 'docker',
}

export function CodeRenderer({ content }: CodeRendererProps) {
  const codeRef = useRef<HTMLElement>(null)

  const normalizedLanguage = languageAliases[content.language.toLowerCase()] || content.language.toLowerCase()

  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current)
    }
  }, [content.code, normalizedLanguage])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content.code)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="relative group">
      <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
          {content.language}
        </span>
        <button
          onClick={handleCopy}
          className="text-xs text-muted-foreground bg-muted hover:bg-muted/80 px-2 py-1 rounded transition-colors"
          title="Copy to clipboard"
        >
          Copy
        </button>
      </div>
      <pre className="rounded-lg bg-[#1a1a1a] p-4 overflow-auto text-sm !m-0">
        <code
          ref={codeRef}
          className={`language-${normalizedLanguage}`}
        >
          {content.code}
        </code>
      </pre>
    </div>
  )
}
